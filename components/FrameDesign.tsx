'use client';

import type { FrameSettings } from '@/lib/frame';
import { api, useResource, useSession } from './client';

// Pick the Frame Dashboard TV's design: painting by day, salon, or painting always.
export function FrameDesign() {
  const { t, run, toast } = useSession();
  const { data, setData, reload } = useResource<FrameSettings>('/api/frame/settings');
  if (!data) return null;
  if (!data.supported) return <p className="meta">{t.frameOld}</p>;
  return (
    <div className="frame-design">
      <span className="label">{t.frameDesign}</span>
      <div className="segmented" role="radiogroup" aria-label={t.frameDesign}>
        {data.layouts.map((l) => (
          <button
            key={l.id}
            type="button"
            role="radio"
            aria-checked={data.layout === l.id}
            className={data.layout === l.id ? 'on' : ''}
            title={l.description}
            onClick={() =>
              run(async () => {
                setData({ ...data, layout: l.id }); // instant, then confirmed by the server
                await api('/api/frame/settings', { method: 'PUT', body: { layout: l.id } });
                toast(`${t.frameDesign}: ${l.name}`);
              }, reload)
            }
          >
            {l.name}
          </button>
        ))}
      </div>
    </div>
  );
}
