'use client';

import Image from 'next/image';
import { useState } from 'react';
import type { Copy } from '@site/lib/copy';
import { addDays, artFor, contain, formatDay, ROTATION_LENGTH, src } from '@site/lib/art';
import { useDay } from './Day';

const PER_LEDGE = 11;

// The next 44 days, leaning on picture ledges, and a finder for any date.
export function Rotation({ c }: { c: Copy }) {
  const { ymd, ready } = useDay();
  const [picked, setPicked] = useState<string | null>(null);
  const days = Array.from({ length: ROTATION_LENGTH }, (_, i) => addDays(ymd, i));
  const ledges = Array.from({ length: Math.ceil(days.length / PER_LEDGE) }, (_, i) => days.slice(i * PER_LEDGE, (i + 1) * PER_LEDGE));
  const shown = picked ?? ymd;
  const found = artFor(shown);
  const [title1, title2] = c.rotation.title.split('\n');

  return (
    <section className="rotation" id="collection" aria-labelledby="rotation-title">
      <div className="rotation__head">
        <h2 id="rotation-title">
          {title1}
          <br />
          {title2}
        </h2>
        <div className="rotation__intro">
          <p>{c.rotation.body}</p>
          <label className="finder">
            <span>{c.rotation.find}</span>
            <input type="date" value={shown} onChange={(e) => setPicked(e.target.value || null)} />
          </label>
          <p className="finder__result" aria-live="polite">
            {c.rotation.result.replace('{date}', formatDay(shown, c.locale, { month: 'long', day: 'numeric', year: 'numeric' }))}{' '}
            <a href={found.source} rel="noopener">
              <em>{found.title}</em>
            </a>
            , {found.artist}.
          </p>
        </div>
      </div>

      <div className="ledges">
        {ledges.map((ledge, li) => (
          <div className="ledge" key={li} data-reveal="">
            <ol className="ledge__works">
              {ledge.map((d, i) => {
                const a = artFor(d);
                const { w, h } = contain(a.ratio, 104, 124);
                const isToday = ready && d === ymd;
                return (
                  <li
                    key={d}
                    className={`ledge__item${isToday ? ' is-today' : ''}${d === shown && picked ? ' is-picked' : ''}`}
                    style={{ ['--i' as string]: i }}
                  >
                    <button
                      type="button"
                      className="ledge__work"
                      onClick={() => setPicked(d)}
                      aria-label={`${formatDay(d, c.locale, { month: 'long', day: 'numeric' })}: ${a.title}, ${a.artist}`}
                    >
                      <Image src={src(a)} alt="" width={w * 2} height={h * 2} sizes="110px" style={{ width: w, height: h }} />
                      <span className="ledge__tip" aria-hidden="true">
                        <em>{a.title}</em>
                        {a.artist}
                      </span>
                    </button>
                    <span className="ledge__date">
                      {isToday ? c.rotation.today : formatDay(d, c.locale, { month: 'short', day: 'numeric' })}
                    </span>
                  </li>
                );
              })}
            </ol>
            <div className="ledge__shelf" aria-hidden="true" />
          </div>
        ))}
      </div>
    </section>
  );
}
