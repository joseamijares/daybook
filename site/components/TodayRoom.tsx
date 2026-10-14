'use client';

import Image from 'next/image';
import type { Copy } from '@site/lib/copy';
import { addDays, artFor, formatDay, src, thumb } from '@site/lib/art';
import { useDay } from './Day';

// Today's painting the way the app hangs it: the whole work at full height,
// a blurred copy of itself behind, and the placard beside it (demo data).
export function TodayRoom({ c }: { c: Copy }) {
  const { ymd } = useDay();
  const a = artFor(ymd);
  const weekday = formatDay(ymd, c.locale, { weekday: 'long' });
  const date = formatDay(ymd, c.locale, { month: 'long', day: 'numeric' });
  // Monday-first week strip around today.
  const dow = (new Date(`${ymd}T00:00:00Z`).getUTCDay() + 6) % 7;
  const week = Array.from({ length: 7 }, (_, i) => addDays(ymd, i - dow));

  return (
    <section className="today" id="today" aria-labelledby="today-caption">
      <Image className="today__blur" src={thumb(a)} alt="" width={640} height={Math.round(640 / a.ratio)} aria-hidden="true" />
      <p className="today__caption" id="today-caption">
        <span className="dot" aria-hidden="true" />
        {c.today.caption}
      </p>

      <figure className="today__art" data-reveal="">
        <div className="today__frame" style={{ ['--r' as string]: a.ratio }}>
          <Image
            src={src(a)}
            alt={`${a.title}, ${a.artist}, ${a.date}`}
            width={1500}
            height={Math.round(1500 / a.ratio)}
          />
          <figcaption className="today__credit">
            <a href={a.source} rel="noopener">
              <em>{a.title}</em>
            </a>
            <span>{[`${a.artist}, ${a.date}`, a.collection].filter(Boolean).join(' · ')}</span>
            {a.fact && <span className="today__fact">{a.fact}</span>}
          </figcaption>
        </div>
      </figure>

      <div className="placard today__placard" data-reveal="">
        <div className="placard__head">
          <div>
            <p className="placard__day">{weekday}</p>
            <p className="placard__date">{date}</p>
          </div>
          <span className="pill pill--ink pill--small">{c.today.plan}</span>
        </div>
        <p className="placard__focus">{c.today.focus}</p>
        <div className="placard__section">
          <p className="placard__rule">
            <b>{c.today.schedule}</b>
            <span>{c.today.meetings}</span>
          </p>
          {c.today.events.map((e) => (
            <p key={e.time} className={`placard__event${e.note ? ' is-next' : ''}`}>
              <span className="placard__time">{e.time}</span>
              <span className="placard__title">{e.title}</span>
              {e.note && <span className="placard__note">{e.note}</span>}
            </p>
          ))}
        </div>
        <div className="placard__section">
          <p className="placard__rule placard__rule--plain">
            <b>{c.today.toDo}</b>
            <span>{c.today.load}</span>
          </p>
          <div className="placard__load" aria-hidden="true">
            <span />
          </div>
          {c.today.tasks.map((t) => (
            <div key={t.title} className={`task task--${t.tone || 'plain'}`}>
              <span className="task__check" aria-hidden="true">
                <svg viewBox="0 0 10 8">
                  <path d="M1 4l2.6 2.6L9 1" />
                </svg>
              </span>
              <span className="task__body">
                <span className="task__title">{t.title}</span>
                {t.meta && <span className="task__meta">{t.meta}</span>}
              </span>
              <span className="task__est">{t.est}</span>
            </div>
          ))}
        </div>
        <div className="placard__week" aria-hidden="true">
          {week.map((d) => (
            <span key={d} className={d === ymd ? 'is-today' : ''}>
              <small>{formatDay(d, c.locale, { weekday: 'short' })}</small>
              <b>{formatDay(d, c.locale, { day: 'numeric' })}</b>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
