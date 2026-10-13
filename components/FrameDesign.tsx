'use client';

import { artFor } from '@/lib/art';
import type { FrameSettings } from '@/lib/frame';
import { api, useResource, useSession } from './client';

// Pick the Frame Dashboard TV's design. Each option is a tiny drawing of the
// TV made with today's painting.
export function FrameDesign() {
  const { session, t, run, toast } = useSession();
  const { data, setData, reload } = useResource<FrameSettings>('/api/frame/settings');
  if (!data) return null;
  if (!data.supported) return <p className="meta">{t.frameOld}</p>;
  const art = `/${artFor(session.today).image}`;
  const current = data.layouts.find((l) => l.id === data.layout);
  return (
    <div className="frame-design">
      <div className="section-head" style={{ borderBottomColor: 'var(--rule)' }}>
        <span className="label">{t.frameDesign}</span>
        <span className="meta">{current?.description}</span>
      </div>
      <div className="design-cards" role="radiogroup" aria-label={t.frameDesign}>
        {data.layouts.map((l) => (
          <button
            key={l.id}
            type="button"
            role="radio"
            aria-checked={data.layout === l.id}
            className={`design-card${data.layout === l.id ? ' on' : ''}`}
            title={l.description}
            onClick={() =>
              data.layout !== l.id &&
              run(async () => {
                setData({ ...data, layout: l.id }); // instant, then confirmed by the server
                await api('/api/frame/settings', { method: 'PUT', body: { layout: l.id } });
                toast(`${t.frameDesign}: ${l.name}`);
              }, reload)
            }
          >
            <Preview kind={l.id} art={art} />
            <span className="name">{l.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Lines({ light }: { light?: boolean }) {
  return (
    <span className={`mini-lines${light ? ' light' : ''}`}>
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

function Painting({ art }: { art: string }) {
  return (
    <span className="mini painting" style={{ backgroundImage: `url(${art})` }}>
      <span className="mini-placard">
        <Lines />
      </span>
    </span>
  );
}

function SalonWall({ art }: { art: string }) {
  return (
    <span className="mini salon">
      <span className="mini-frame" style={{ backgroundImage: `url(${art})` }} />
      <Lines light />
    </span>
  );
}

function Preview({ kind, art }: { kind: string; art: string }) {
  if (kind === 'painting') return <span className="preview"><Painting art={art} /></span>;
  if (kind === 'salon') return <span className="preview"><SalonWall art={art} /></span>;
  // Day and night: the painting by day, the salon after dark.
  return (
    <span className="preview split">
      <span className="half day"><Painting art={art} /></span>
      <span className="half night"><SalonWall art={art} /></span>
    </span>
  );
}
