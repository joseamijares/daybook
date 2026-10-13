'use client';

// Settings → Appearance: one of three designs, one of three palettes, and
// whether the room turns to Nocturne after shutdown. Changes show at once.

import { DEFAULT_APPEARANCE, type Palette, type Style } from '@/lib/appearance';
import { useSession } from './client';

const Radio = ({ on }: { on: boolean }) => (
  <span className={`radio${on ? ' on' : ''}`} aria-hidden>
    {on && (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M2.5 6.2 4.9 8.5 9.5 3.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )}
  </span>
);

// Fixed colours: each card shows its own palette, whatever the room wears now.
const ROOMS: Record<Palette, { wall: string; paper: string; ink: string; quiet: string; accent: string; dot?: boolean }> = {
  salon: { wall: '#1a1612', paper: '#ece6d8', ink: '#1e1a14', quiet: '#5a544a', accent: '#34507f' },
  modern: { wall: '#e7e6e2', paper: '#fbfaf7', ink: '#111111', quiet: '#5b5b5b', accent: '#c2331b', dot: true },
  nocturne: { wall: '#0c0e12', paper: '#1b1f26', ink: '#ece6d8', quiet: '#a49e92', accent: '#c9a55e' },
};

const FACES: Record<Style, { font: string; weight: number; stretch?: string }> = {
  wall: { font: 'var(--font-schibsted)', weight: 700 },
  timetable: { font: 'var(--font-archivo)', weight: 800, stretch: '125%' },
  notebook: { font: 'var(--font-brygada)', weight: 600 },
};

export function AppearanceSettings() {
  const { session, t, setAppearance } = useSession();
  const look = session.appearance || DEFAULT_APPEARANCE;
  const art = session.art ? (/^https?:/.test(session.art.image) ? session.art.image : `/${session.art.image}`) : null;

  const styles: { id: Style; name: string; desc: string }[] = [
    { id: 'wall', name: t.wall, desc: t.wallDesc },
    { id: 'timetable', name: t.timetable, desc: t.timetableDesc },
    { id: 'notebook', name: t.notebook, desc: t.notebookDesc },
  ];
  const palettes: { id: Palette; name: string; desc: string }[] = [
    { id: 'salon', name: t.salon, desc: t.salonDesc },
    { id: 'modern', name: t.modern, desc: t.modernDesc },
    { id: 'nocturne', name: t.nocturne, desc: t.nocturneDesc },
  ];

  return (
    <div className="settings-block" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="section-head">
          <span className="label">{t.design}</span>
          <span className="meta">{t.designLead}</span>
        </div>
        <div className="look-grid">
          {styles.map((s) => {
            const face = FACES[s.id];
            return (
              <button key={s.id} type="button" className="look-card" aria-pressed={look.style === s.id} onClick={() => setAppearance({ style: s.id })}>
                <span className="preview">
                  <span className="specimen" style={{ fontFamily: face.font }}>
                    <b style={{ fontWeight: face.weight, fontStretch: face.stretch, fontVariationSettings: face.stretch ? `'wdth' ${parseInt(face.stretch)}` : undefined, fontSize: s.id === 'notebook' ? 22 : undefined, lineHeight: s.id === 'notebook' ? '26px' : undefined }}>
                      {s.id === 'wall' ? t.specimenDay : s.id === 'timetable' ? '13' : t.specimenDate}
                    </b>
                    <small style={{ fontStyle: s.id === 'wall' ? 'italic' : undefined }}>{s.id === 'notebook' ? t.specimenFocus : t.specimenTask}</small>
                  </span>
                </span>
                <span className="pick-row">
                  <span>
                    <span className="pick-name" style={{ display: 'block' }}>
                      {s.name}
                    </span>
                    <span className="pick-desc">{s.desc}</span>
                  </span>
                  <Radio on={look.style === s.id} />
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="section-head">
          <span className="label">{t.palette}</span>
          <span className="meta">{t.paletteLead}</span>
        </div>
        <div className="look-grid">
          {palettes.map((p) => {
            const room = ROOMS[p.id];
            return (
              <button key={p.id} type="button" className="look-card" aria-pressed={look.palette === p.id} onClick={() => setAppearance({ palette: p.id })}>
                <span className="preview">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {art && <img src={art} alt="" style={{ opacity: p.id === 'nocturne' ? 0.8 : 1 }} />}
                  <span className="room" style={{ background: room.wall }}>
                    <span className="mini-card" style={{ background: room.paper, boxShadow: p.id === 'nocturne' ? '0 0 0 1px #2a2f37' : '0 4px 12px -6px rgba(0,0,0,0.35)' }}>
                      <i style={{ width: '58%', height: 9, background: room.ink }} />
                      <i style={{ width: '38%', background: room.quiet }} />
                      <i style={{ height: 2, marginTop: 6, background: p.id === 'nocturne' ? room.accent : room.ink }} />
                      <i style={{ width: '88%', background: room.ink }} />
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {room.dot && <i style={{ width: 5, height: 5, borderRadius: 999, background: room.accent }} />}
                        <i style={{ width: '62%', height: 4, background: room.accent }} />
                      </span>
                      <i style={{ width: '76%', background: room.ink }} />
                    </span>
                  </span>
                </span>
                <span className="pick-row">
                  <span>
                    <span className="pick-name" style={{ display: 'block' }}>
                      {p.name}
                    </span>
                    <span className="pick-desc">{p.desc}</span>
                  </span>
                  <Radio on={look.palette === p.id} />
                </span>
              </button>
            );
          })}
        </div>
        <div className="toggle-row">
          <span>
            <span style={{ display: 'block', fontSize: 15, fontWeight: 600 }}>{t.eveningNocturne}</span>
            <span className="meta">{t.eveningNocturneLead}</span>
          </span>
          <button
            type="button"
            className="toggle"
            role="switch"
            aria-checked={look.eveningNocturne}
            aria-label={t.eveningNocturne}
            onClick={() => setAppearance({ eveningNocturne: !look.eveningNocturne })}
          >
            <i />
          </button>
        </div>
      </div>
    </div>
  );
}
