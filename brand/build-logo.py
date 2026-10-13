"""Build the Daybook logo set (direction 02a "Rail horizon") as SVG + app icons.

The mark is a gilt portrait frame whose bottom rail is the horizon, with a half-sun rising from it.
The wordmark is "Daybook" in Instrument Serif Regular, outlined to paths so it renders without the font.

Usage:  python3 brand/build-logo.py [font]
        font defaults to brand/fonts/InstrumentSerif-Regular-latin.woff2 (Google Fonts latin subset, OFL)
Rail thickness is optically sized per use: 0.05 mark/stacked, 0.07 horizontal (runs small), heavier
still on icons that render at 16-32 px. Needs rsvg-convert and ImageMagick (brew install librsvg imagemagick).

Writes:
  public/brand/daybook-{mark,lockup,lockup-stacked}{,-dark}.svg   logos
  app/icon.svg, app/favicon.ico, app/apple-icon.png               browser tab, iOS home screen
  public/icons/icon-{192,512,maskable-512,monochrome-512}.png     web app manifest (Android, Samsung Galaxy, desktop installs)
  mac/Daybook/Assets.xcassets/AppIcon.appiconset/icon_*.png       Mac app (Apple's 824 px body on a 1024 grid)
  mac/Daybook/Assets.xcassets/MenuBarIcon.imageset/menubar.svg    Mac menu bar (template image)
  brand/icons/samsung-tv/*.png                                    Samsung TV (Tizen): Seller Office + config.xml
"""
import json, pathlib, subprocess, sys, tempfile

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


def stacked(d, ww, asc, desc, c):
    """Frame centred over the word. Returns (w, h, body)."""
    fh, gap = asc * 3, asc * 0.42
    fw = fh * FRAME_W
    word = f'<path fill="{c["word"]}" transform="translate(0 {f(fh + gap + asc)})" d="{d}"/>'
    return ww, fh + gap + asc + desc, mark((ww - fw) / 2, 0, fh, c) + word


def centred(s, fh, c, rail):
    """The mark centred in an s×s square, frame height fh."""
    return mark((s - fh * FRAME_W) / 2, (s - fh) / 2, fh, c, rail=rail)


def fit(body_w, body_h, body, cw, ch, height):
    """Scale a body to `height` and centre it on a cw×ch canvas."""
    k = height / body_h
    x, y = (cw - body_w * k) / 2, (ch - height) / 2
    return f'<g transform="translate({f(x)} {f(y)}) scale({k:.5f})">{body}</g>'


def png(svg_text, out, w, h=None, rgb=None):
    """Render SVG to PNG. rgb=<hex> flattens onto that colour and drops alpha (24-bit)."""
    out.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["rsvg-convert", "-w", str(w), "-h", str(h or w), "-o", str(out)], input=svg_text.encode(), check=True)
    if rgb:
        subprocess.run(["magick", str(out), "-background", rgb, "-alpha", "remove", "-alpha", "off",
                        "-define", "png:color-type=2", str(out)], check=True)


def mac_icon(fh, rail):
    """macOS app icon on Apple's grid: 824 px rounded body centred on 1024, soft drop shadow."""
    body = (
        '<defs><filter id="s" x="-10%" y="-10%" width="120%" height="125%">'
        '<feGaussianBlur in="SourceAlpha" stdDeviation="10"/><feOffset dy="10"/>'
        '<feComponentTransfer><feFuncA type="linear" slope="0.35"/></feComponentTransfer>'
        '<feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>'
        '<rect x="100" y="100" width="824" height="824" rx="185" fill="#161D19" filter="url(#s)"/>'
        + centred(1024, fh, DARK, rail)
    )
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">{body}</svg>\n'


def icons(d, ww, asc, desc):
    # Browser tab: wall tile, heavier rail so it survives 16 px. Also as .ico for older browsers.
    s, fh = 64, 46
    tab = svg(s, s, f'<rect width="{s}" height="{s}" rx="14" fill="{WALL}"/>' + centred(s, fh, DARK, 0.085))
    (ROOT / "app/icon.svg").write_text(tab)
    with tempfile.TemporaryDirectory() as tmp:
        sizes = [pathlib.Path(tmp) / f"{n}.png" for n in (16, 32, 48)]
        for n, path in zip((16, 32, 48), sizes):
            png(tab, path, n)
        subprocess.run(["magick", *map(str, sizes), str(ROOT / "app/favicon.ico")], check=True)

    # iOS home screen: full-bleed square (iOS rounds the corners).
    s = 180
    png(svg(s, s, f'<rect width="{s}" height="{s}" fill="{WALL}"/>' + centred(s, 112, DARK, 0.065)), ROOT / "app/apple-icon.png", s, rgb=WALL)

    # Web app manifest. "any" keeps its own rounded tile; "maskable" is full-bleed with the mark inside the
    # 80 % safe circle (Android/One UI crop it to their own shape); "monochrome" is alpha only, for themed icons.
    web = ROOT / "public/icons"
    s = 512
    tile = svg(s, s, f'<rect width="{s}" height="{s}" rx="{s * 0.22:.0f}" fill="{WALL}"/>' + centred(s, s * 0.6, DARK, 0.065))
    png(tile, web / "icon-192.png", 192)
    png(tile, web / "icon-512.png", 512)
    png(svg(s, s, f'<rect width="{s}" height="{s}" fill="{WALL}"/>' + centred(s, s * 0.54, DARK, 0.065)), web / "icon-maskable-512.png", s, rgb=WALL)
    white = {"frame": "#FFFFFF", "sun": "#FFFFFF", "word": "#FFFFFF"}
    png(svg(s, s, centred(s, s * 0.54, white, 0.075)), web / "icon-monochrome-512.png", s)

    # Mac app icon. Small sizes get a bigger frame and heavier rail so they stay legible.
    mac = ROOT / "mac/Daybook/Assets.xcassets"
    large, small = mac_icon(520, 0.05), mac_icon(600, 0.11)
    (ROOT / "brand/macos-icon.svg").write_text(large)
    for n in (16, 32, 64, 128, 256, 512, 1024):
        png(small if n <= 32 else mac_icon(540, 0.075) if n == 64 else large, mac / f"AppIcon.appiconset/icon_{n}.png", n)

    # Mac menu bar: a template image (black + alpha; macOS tints it for light/dark menu bars). 12×16 pt.
    bar = mac / "MenuBarIcon.imageset"
    bar.mkdir(parents=True, exist_ok=True)
    black = {"frame": "#000000", "sun": "#000000", "word": "#000000"}
    (bar / "menubar.svg").write_text(svg(12, 16, mark(0, 0, 16, black, rail=0.1)).replace("<svg ", '<svg width="12" height="16" ', 1))
    (bar / "Contents.json").write_text(json.dumps({
        "images": [{"filename": "menubar.svg", "idiom": "universal"}],
        "info": {"author": "xcode", "version": 1},
        "properties": {"preserves-vector-representation": True, "template-rendering-intent": "template"},
    }, indent=2) + "\n")

    # Samsung TV (Tizen). Seller Office: 1920×1080 logo (32-bit PNG, transparent) over a 1920×1080 background
    # (24-bit), plus a 512×423 icon (24-bit, no transparency). config.xml takes a square icon.png.
    tv = ROOT / "brand/icons/samsung-tv"
    lock = stacked(d, ww, asc, desc, DARK)
    png(svg(1920, 1080, fit(*lock, 1920, 1080, 500)), tv / "logo-1920x1080.png", 1920, 1080)
    png(svg(1920, 1080, f'<rect width="1920" height="1080" fill="{WALL}"/>'), tv / "background-1920x1080.png", 1920, 1080, rgb=WALL)
    png(svg(512, 423, f'<rect width="512" height="423" fill="{WALL}"/>' + fit(*lock, 512, 423, 270)), tv / "icon-512x423.png", 512, 423, rgb=WALL)
    png(svg(512, 512, f'<rect width="512" height="512" fill="{WALL}"/>' + centred(512, 300, DARK, 0.065)), tv / "icon.png", 512, rgb=WALL)


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
        (out / f"daybook-lockup-stacked{suffix}.svg").write_text(svg(*stacked(d, ww, asc, desc, c)))

    icons(d, ww, asc, desc)
    print("wordmark", f(ww), "x", f(asc + desc), "units; files written")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ROOT / "brand/fonts/InstrumentSerif-Regular-latin.woff2")
