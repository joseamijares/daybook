'use client';

import { useEffect, useState } from 'react';
import type { Carry, DayView } from '@/lib/daybook';
import { longDate } from '@/lib/i18n';
import { wrapLine } from '@/lib/recap';
import { minutesLabel } from '@/lib/time';
import { api, useResource, useSession } from './client';
import { DraftText } from './DraftText';
import { Check } from './TaskRow';

const NEXT: Record<Carry, Carry> = { tomorrow: 'backlog', backlog: 'keep', keep: 'tomorrow' };

export function ShutdownView() {
  const { session, t } = useSession();
  const { data: day, reload } = useResource<DayView>(`/api/day?date=${session.today}`);
  if (!day) {
    return (
      <section className="placard night">
        <p className="meta">{t.loading}</p>
      </section>
    );
  }
  // Keyed so a shutdown made elsewhere (an agent, another tab) resets the form.
  return <Wrap key={`${day.shutdownAt}:${day.note}`} day={day} reload={reload} />;
}

function useClock(locale: string, tz: string) {
  const fmt = () => new Intl.DateTimeFormat(locale === 'es' ? 'es-MX' : 'en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(new Date());
  const [now, setNow] = useState(fmt);
  useEffect(() => {
    const timer = setInterval(() => setNow(fmt()), 30000);
    return () => clearInterval(timer);
  });
  return now;
}

function Wrap({ day, reload }: { day: DayView; reload: () => Promise<void> }) {
  const { session, t, run, toast } = useSession();
  const [carry, setCarry] = useState<Record<string, Carry>>({});
  const [note, setNote] = useState(day.note || '');
  const [closed, setClosed] = useState(Boolean(day.shutdownAt));
  const now = useClock(session.locale, session.tz);

  const done = day.tasks.filter((x) => x.done);
  const open = day.tasks.filter((x) => !x.done);
  const where = (id: string): Carry => carry[id] || 'tomorrow';
  const moving = open.filter((x) => where(x.id) !== 'keep').length;
  const worked = done.reduce((s, x) => s + (x.estimate || 0), 0);
  const label = (c: Carry) => (c === 'tomorrow' ? t.tomorrow : c === 'backlog' ? t.backlog : t.keep);

  const close = () =>
    run(async () => {
      const r = await api<{ summary: string }>('/api/shutdown', { method: 'POST', body: { date: day.date, note, carry } });
      toast(r.summary);
      setClosed(true);
    }, reload);

  return (
    <section className="placard night" aria-label={t.shutDown}>
      <div>
        <p className="eyebrow">
          {longDate(day.date, session.locale)}
          {now && ` · ${now}`}
        </p>
        <h1 className="big">{t.wrapped}</h1>
      </div>
      <p className="focus" style={{ margin: 0, fontSize: 28, lineHeight: '33px' }}>
        {closed && !open.length ? t.doneForTheDay : wrapLine(day.tasks, closed ? 0 : moving, session.locale)}
      </p>

      <div>
        <div className="section-head">
          <span className="label">{session.locale === 'es' ? 'Hecho' : 'Done'}</span>
          <span className="meta">{minutesLabel(worked)}</span>
        </div>
        <div className="rows">
          {!done.length && <p className="empty">–</p>}
          {done.map((task) => (
            <div key={task.id} className="row" style={{ fontSize: 16 }}>
              <span style={{ width: 18, flexShrink: 0, color: 'var(--color-gilt-ink)' }}>✓</span>
              <span className="title">
                {task.title}
                {task.source && <span className="meta"> · {task.source.key}</span>}
              </span>
              <span className="est" style={{ color: 'var(--color-card-ink-2)' }}>
                {task.estimate ? minutesLabel(task.estimate) : ''}
              </span>
            </div>
          ))}
        </div>
      </div>

      {open.length > 0 && (
        <div>
          <div className="section-head">
            <span className="label">{t.carryOver}</span>
            <span className="meta">{t.tapToChange}</span>
          </div>
          <div className="rows">
            {open.map((task) => (
              <div key={task.id} className="row" style={{ fontSize: 16 }}>
                <Check on={false} onClick={() => run(() => api(`/api/tasks/${task.id}`, { method: 'PATCH', body: { done: true } }), reload)} label={task.title} />
                <span className="title">{task.title}</span>
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => setCarry((c) => ({ ...c, [task.id]: NEXT[where(task.id)] }))}
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: 'var(--tracking-label)',
                    textTransform: 'uppercase',
                    color: where(task.id) === 'tomorrow' ? 'var(--color-gilt-ink)' : 'var(--color-card-ink-2)',
                  }}
                >
                  {label(where(task.id))}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 14, borderTop: '1px solid var(--color-card-ink)' }}>
        <span className="label">{t.journal}</span>
        <DraftText className="journal" value={note} placeholder={t.journalPlaceholder} label={t.journal} multiline onDraft={setNote} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, marginTop: 'auto' }}>
        <span className="meta" style={{ fontSize: 12, maxWidth: 240 }}>
          {session.frame ? t.frameNote : closed ? t.doneForTheDay : ''}
        </span>
        {closed && !open.length ? (
          <button type="button" className="pill" onClick={() => setClosed(false)}>
            {t.reopen}
          </button>
        ) : (
          <button type="button" className="pill solid" style={{ padding: '12px 22px', fontSize: 14 }} onClick={close}>
            {t.closeTheDay}
          </button>
        )}
      </div>
    </section>
  );
}
