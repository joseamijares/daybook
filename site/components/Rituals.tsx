import Image from 'next/image';
import type { Copy } from '@site/lib/copy';
import { src, work } from '@site/lib/art';

// Morning and evening as a diptych: a painting for each, and the ritual's
// own placard underneath (demo data).
export function Rituals({ c }: { c: Copy }) {
  const morning = work('monet-the-beach-at-sainte-adresse');
  const evening = work('hiroshige-evening-snow-at-kanbara');
  const r = c.rituals;

  return (
    <section className="rituals" aria-label={`${r.morningTitle} ${r.eveningTitle}`}>
      <div className="ritual ritual--morning" data-reveal="">
        <p className="eyebrow">{r.morning}</p>
        <h2>{r.morningTitle}</h2>
        <figure className="ritual__work work--gilt">
          <div className="ritual__frame">
            <Image
              src={src(morning)}
              alt={`${morning.title}, ${morning.artist}, ${morning.date}`}
              width={1500}
              height={Math.round(1500 / morning.ratio)}
            />
          </div>
          <figcaption>
            <a href={morning.source} rel="noopener">
              <em>
                {morning.title}, {morning.date}
              </em>
            </a>
            <span>
              {morning.artist} · {morning.collection}
            </span>
          </figcaption>
        </figure>
        <div className="placard placard--plan">
          <p className="placard__row">
            <b className="placard__h">{c.today.plan}</b>
            <span>{r.plan.load}</span>
          </p>
          <p className="placard__input">
            <span aria-hidden="true">+</span> {r.plan.input}
          </p>
          {r.plan.rows.map((row) => (
            <p key={row.title} className="placard__line">
              <span className="placard__grip" aria-hidden="true">
                ⋮
              </span>
              <span className="placard__title">{row.title}</span>
              <span className={`placard__tag tone--${row.tone || 'plain'}`}>{row.tag}</span>
              <span className="placard__est">{row.est}</span>
            </p>
          ))}
        </div>
      </div>

      <div className="ritual ritual--evening" data-reveal="">
        <p className="eyebrow">{r.evening}</p>
        <h2>{r.eveningTitle}</h2>
        <figure className="ritual__work work--paper">
          <div className="ritual__frame">
            <Image
              src={src(evening)}
              alt={`${evening.title}, ${evening.artist}, ${evening.date}`}
              width={1500}
              height={Math.round(1500 / evening.ratio)}
            />
          </div>
          <figcaption>
            <a href={evening.source} rel="noopener">
              <em>
                {evening.title}, {evening.date}
              </em>
            </a>
            <span>
              {evening.artist} · {evening.collection}
            </span>
          </figcaption>
        </figure>
        <div className="placard placard--shutdown">
          <p className="placard__wrapped">
            <span className="placard__clock">{r.shutdown.time}</span>
            <span>
              <b>{r.shutdown.wrapped}</b>
            </span>
          </p>
          <p className="placard__tally">{r.shutdown.tally}</p>
          {r.shutdown.rows.map((row) => (
            <p key={row.title} className="placard__line">
              <span className="placard__title">{row.title}</span>
              <span className="seg">
                {r.shutdown.choices.map((choice, i) => (
                  <span key={choice} className={i === row.pick ? 'is-on' : ''}>
                    {choice}
                  </span>
                ))}
              </span>
            </p>
          ))}
          <p className="placard__journal-h">{r.shutdown.journal}</p>
          <p className="placard__journal">{r.shutdown.line}</p>
        </div>
      </div>
    </section>
  );
}
