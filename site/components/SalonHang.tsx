'use client';

import Image from 'next/image';
import type { CSSProperties } from 'react';
import type { Copy } from '@site/lib/copy';
import { addDays, artFor, contain, daysUntil, formatDay, src, thumb, work, type Artwork } from '@site/lib/art';
import { CENTER, RESERVES, SLOTS, type FrameKind, type Placement } from '@site/lib/hang';
import { useDay } from './Day';
import { FilmButton } from './Film';

type Vars = CSSProperties & Record<`--${string}`, string | number>;

// Frame, liner/mat and painting size for one composition, as CSS variables
// (d = desktop wall, m = mobile wall). The stylesheet turns them into lengths.
function vars(prefix: 'd' | 'm', p: Placement, a: Artwork): Vars {
  const { w, h } = contain(a.ratio, p.w, p.h);
  return {
    [`--${prefix}x`]: p.x + (p.w - w) / 2,
    [`--${prefix}y`]: p.y + (p.h - h),
    [`--${prefix}w`]: w,
    [`--${prefix}h`]: h,
    [`--${prefix}pad`]: p.pad,
    [`--${prefix}in`]: p.inner,
  };
}

// Sized by the stylesheet from the frame's variables; never cropped.
function Painting({ a, small, priority }: { a: Artwork; small?: boolean; priority?: boolean }) {
  return (
    <Image
      src={small ? thumb(a) : src(a)}
      alt={`${a.title}, ${a.artist}, ${a.date}`}
      width={1500}
      height={Math.round(1500 / a.ratio)}
      priority={priority}
      draggable={false}
    />
  );
}

export function SalonHang({ c }: { c: Copy }) {
  const { ymd, ready } = useDay();
  const today = artFor(ymd);
  const hungSlugs = new Set(SLOTS.map((s) => s.slug));
  const reserve = RESERVES.find((r) => r !== today.slug && !hungSlugs.has(r)) ?? RESERVES[0];

  const label = (a: Artwork) => {
    const n = daysUntil(a.slug, ymd);
    return n === 0
      ? c.hero.hangsToday
      : c.hero.hangsOn.replace('{date}', formatDay(addDays(ymd, n), c.locale, { month: 'long', day: 'numeric' }));
  };

  const center = {
    d: contain(today.ratio, CENTER.desktop.w, CENTER.desktop.h),
    m: contain(today.ratio, CENTER.mobile.w, CENTER.mobile.h),
  };
  const centerVars: Vars = {
    '--dx': CENTER.desktop.cx - center.d.w / 2 - CENTER.desktop.pad - CENTER.desktop.inner,
    '--dy': CENTER.desktop.y,
    '--dw': center.d.w,
    '--dh': center.d.h,
    '--dpad': CENTER.desktop.pad,
    '--din': CENTER.desktop.inner,
    '--mx': CENTER.mobile.cx - center.m.w / 2 - CENTER.mobile.pad - CENTER.mobile.inner,
    '--my': CENTER.mobile.y,
    '--mw': center.m.w,
    '--mh': center.m.h,
    '--mpad': CENTER.mobile.pad,
    '--min': CENTER.mobile.inner,
    // The brass plaque hangs just under whatever size today's painting is.
    '--dplaque': CENTER.desktop.y + center.d.h + 2 * (CENTER.desktop.pad + CENTER.desktop.inner) + 22,
    '--mplaque': CENTER.mobile.y + center.m.h + 2 * (CENTER.mobile.pad + CENTER.mobile.inner) + 14,
  };

  return (
    <div className={`hang${ready ? ' is-lit' : ''}`} data-parallax="">
      <div className="hang__glow" aria-hidden="true" />
      <div className="hang__lamp" aria-hidden="true" style={centerVars}>
        <span />
      </div>

      {SLOTS.map((slot, i) => {
        const a = slot.slug === today.slug ? work(reserve) : work(slot.slug);
        const style: Vars = {
          ...vars('d', slot.desktop, a),
          ...(slot.mobile ? vars('m', slot.mobile, a) : {}),
          '--i': i,
          '--depth': 1 + (i % 3) * 0.35,
        };
        return (
          <figure
            key={slot.slug}
            className={`work work--${slot.kind satisfies FrameKind}`}
            data-mobile={slot.mobile ? '1' : '0'}
            data-tip={slot.desktop.y > 560 ? 'above' : 'below'}
            style={style}
          >
            <div className="work__frame">
              <div className="work__inner">
                <Painting a={a} small />
              </div>
            </div>
            <figcaption className="work__label">
              <em>{a.title}</em>
              <span>
                {a.artist}, {a.date}
              </span>
              <span className="work__when">{label(a)}</span>
            </figcaption>
          </figure>
        );
      })}

      {/* A tall painting (narrower than 320 on the 1440 wall) gets the compact play button. */}
      <figure
        className={`work work--gilt work--today${center.d.w < 320 ? ' is-narrow' : ''}`}
        data-mobile="1"
        style={centerVars}
      >
        <div className="work__frame">
          <div className="work__inner">
            <Painting a={today} priority />
            <FilmButton c={c} />
          </div>
        </div>
        <figcaption className="sr-only">
          {today.title}, {today.artist}, {today.date}
        </figcaption>
      </figure>

      <div className="hang__plaque" style={centerVars}>
        <span>
          {c.hero.plaque}, {formatDay(ymd, c.locale, { month: 'long', day: 'numeric' })}
        </span>
        <em>
          {today.artist.split(' ').slice(-1)[0]}, {today.title}
        </em>
      </div>
    </div>
  );
}
