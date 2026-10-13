"""Build the Daybook logo set (direction 02a "Rail horizon") as SVG + app icons.

The mark is a gilt portrait frame whose bottom rail is the horizon, with a half-sun rising from it.
The wordmark is "Daybook" in Instrument Serif Regular, outlined to paths so it renders without the font.

Usage:  python3 brand/build-logo.py [font]
        font defaults to brand/fonts/InstrumentSerif-Regular-latin.woff2 (Google Fonts latin subset, OFL)
Rail thickness is optically sized per use: 0.05 mark/stacked, 0.07 horizontal (runs small), 0.085 favicon.
Writes: public/brand/daybook-{mark,lockup,lockup-stacked}{,-dark}.svg, app/icon.svg, app/apple-icon.png
"""
import pathlib, subprocess, sys

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
WORD = "Daybook"
GILT, INK, BONE, WALL = "#C8A45C", "#1E1A14", "#ECE6D8", "#111613"
LIGHT = {"frame": GILT, "sun": INK, "word": INK}
DARK = {"frame": GILT, "sun": BONE, "word": BONE}

# Mark proportions, relative to frame height h.
FRAME_W = 0.75  # portrait frame, 3:4
RAIL = 0.05  # frame thickness
SUN_R = 0.25  # half-sun radius


def f(n):
    return f"{n:.2f}".rstrip("0").rstrip(".")


def mark(x, y, h, c, rail=RAIL):
    """Frame + half-sun with the frame's top-left corner at (x, y)."""
    w, t, r = h * FRAME_W, h * rail, h * SUN_R
    outer = f"M{f(x)} {f(y)}h{f(w)}v{f(h)}h{f(-w)}z"
    inner = f"M{f(x + t)} {f(y + t)}v{f(h - 2 * t)}h{f(w - 2 * t)}v{f(-(h - 2 * t))}z"
    cx, base = x + w / 2, y + h - t
    sun = f"M{f(cx - r)} {f(base)}a{f(r)} {f(r)} 0 0 1 {f(2 * r)} 0z"
    return (
        f'<path fill="{c["frame"]}" fill-rule="evenodd" d="{outer}{inner}"/>'
        f'<path fill="{c["sun"]}" d="{sun}"/>'
    )


def kerning(font):
    """Pair kerning from GPOS PairPos lookups (formats 1 and 2), in font units."""
    pairs = {}
    if "GPOS" not in font:
        return lambda a, b: 0
    gpos = font["GPOS"].table
    for lookup in gpos.LookupList.Lookup:
        for st in lookup.SubTable:
            if lookup.LookupType == 9:
                st = st.ExtSubTable
            if getattr(st, "LookupType", 2) != 2 or not hasattr(st, "Format"):
                continue
            firsts = st.Coverage.glyphs
            if st.Format == 1:
                for g1, ps in zip(firsts, st.PairSet):
                    for pv in ps.PairValueRecord:
                        v = getattr(pv.Value1, "XAdvance", 0) if pv.Value1 else 0
                        pairs.setdefault((g1, pv.SecondGlyph), v)
            elif st.Format == 2:
                c1, c2 = st.ClassDef1.classDefs, st.ClassDef2.classDefs
                for g1 in firsts:
                    row = st.Class1Record[c1.get(g1, 0)]
                    for g2 in font.getGlyphOrder():
                        rec = row.Class2Record[c2.get(g2, 0)]
                        v = getattr(rec.Value1, "XAdvance", 0) if rec.Value1 else 0
                        if v:
                            pairs.setdefault((g1, g2), v)
    return lambda a, b: pairs.get((a, b), 0)


def wordmark(font_path):
    """Outlined "Daybook" at 1 unit = 1 font unit, ink starting at x=0, baseline at y=0.
    Returns (d, width, ascent, descent)."""
    font = TTFont(font_path)
    gs, cmap, hmtx = font.getGlyphSet(), font.getBestCmap(), font["hmtx"]
    kern = kerning(font)
    names = [cmap[ord(ch)] for ch in WORD]
    bounds, x = BoundsPen(gs), 0
    for pass_ in ("measure", "draw"):
        if pass_ == "draw":
            x0, y0, x1, y1 = bounds.bounds
            pen, x = SVGPathPen(gs), -x0  # trim the D's left side bearing
        for i, name in enumerate(names):
            flip = (1, 0, 0, -1, x, 0)  # font y-up → SVG y-down
            gs[name].draw(TransformPen(bounds if pass_ == "measure" else pen, flip))
            x += hmtx[name][0] + (kern(name, names[i + 1]) if i + 1 < len(names) else 0)
    return pen.getCommands(), x1 - x0, -y0, y1


def svg(w, h, body, label="Daybook"):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {f(w)} {f(h)}" '
        f'role="img" aria-label="{label}">{body}</svg>\n'
    )


def main(font_path):
    d, ww, asc, desc = wordmark(font_path)
    out = ROOT / "public/brand"
    out.mkdir(parents=True, exist_ok=True)

    for suffix, c in (("", LIGHT), ("-dark", DARK)):
        # Mark alone.
        h = 100
        (out / f"daybook-mark{suffix}.svg").write_text(svg(h * FRAME_W, h, mark(0, 0, h, c)))

        # Horizontal lockup: frame spans baseline → ascender, the y's tail hangs below.
        # Heavier rail, since this one runs small (nav, headers).
        fh, gap = asc, asc * 0.34
        word = f'<path fill="{c["word"]}" transform="translate({f(fh * FRAME_W + gap)} {f(asc)})" d="{d}"/>'
        (out / f"daybook-lockup{suffix}.svg").write_text(
            svg(fh * FRAME_W + gap + ww, asc + desc, mark(0, 0, fh, c, rail=0.07) + word)
        )

        # Stacked lockup: frame centred over the word.
        fh, gap = asc * 3, asc * 0.42
        fw = fh * FRAME_W
        word = f'<path fill="{c["word"]}" transform="translate(0 {f(fh + gap + asc)})" d="{d}"/>'
        (out / f"daybook-lockup-stacked{suffix}.svg").write_text(
            svg(ww, fh + gap + asc + desc, mark((ww - fw) / 2, 0, fh, c) + word)
        )

    # Favicon: wall tile, heavier rail so it survives 16px.
    s, fh = 64, 46
    tile = f'<rect width="{s}" height="{s}" rx="14" fill="{WALL}"/>'
    (ROOT / "app/icon.svg").write_text(svg(s, s, tile + mark((s - fh * FRAME_W) / 2, (s - fh) / 2, fh, DARK, rail=0.085)))

    # Apple touch icon: full-bleed square (iOS rounds the corners), rendered to PNG.
    s, fh = 180, 112
    apple = svg(s, s, f'<rect width="{s}" height="{s}" fill="{WALL}"/>' + mark((s - fh * FRAME_W) / 2, (s - fh) / 2, fh, DARK, rail=0.065))
    subprocess.run(
        ["rsvg-convert", "-w", "180", "-h", "180", "-o", str(ROOT / "app/apple-icon.png")],
        input=apple.encode(), check=True,
    )
    print("wordmark", f(ww), "x", f(asc + desc), "units; files written")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ROOT / "brand/fonts/InstrumentSerif-Regular-latin.woff2")
