import Image from 'next/image';
import type { Copy } from '@site/lib/copy';
import { FRAME_URL } from '@site/lib/site';

// The Frame at home. One room, two real Frame Dashboard screens: the day
// screen fades to the night one as you scroll through (--p from Motion).
export function FrameRoom({ c }: { c: Copy }) {
  return (
    <section className="frame-room" id="frame" aria-labelledby="frame-title">
      <div className="frame-room__heading">
        <p className="eyebrow eyebrow--bone">{c.frame.label}</p>
        <h2 id="frame-title">{c.frame.title}</h2>
      </div>
      <div className="frame-room__stage" data-progress="">
        <Image
          className="frame-room__photo frame-room__photo--day"
          src="/img/room-day.webp"
          alt=""
          width={2000}
          height={1116}
          aria-hidden="true"
        />
        <Image
          className="frame-room__photo frame-room__photo--night"
          src="/img/room-night.webp"
          alt={c.frame.alt}
          width={2000}
          height={1116}
        />
        <div className="frame-room__label" data-reveal="">
          <b>{c.frame.wallTitle}</b>
          <span>{c.frame.wallBody}</span>
          <span>{c.frame.wallSync}</span>
        </div>
      </div>
      <div className="frame-room__notes">
        <p>{c.frame.body}</p>
        <div>
          <a className="link-gilt" href={FRAME_URL}>
            {c.frame.link} <span aria-hidden="true">↗</span>
          </a>
          <small>{c.frame.caption}</small>
        </div>
      </div>
    </section>
  );
}
