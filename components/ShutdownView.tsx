'use client';

import { useEffect, useState } from 'react';
import type { Carry, DayView } from '@/lib/daybook';
import { dayNum, fill, hoursSaid, longDate, weekdayName } from '@/lib/i18n';
import { wrapLine } from '@/lib/recap';
import { addDays, minutesLabel } from '@/lib/time';
import { api, timeIn, useLook, useResource, useSession } from './client';
import { capitalize } from './day';
import { DraftText } from './DraftText';
import { Masthead } from './Masthead';
import { FrameIcon } from './TodayView';

const Tick = () => (
  <span className="tick" aria-hidden>
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
      <path d="M2.5 6.2L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </span>
);

export function ShutdownView() {
  const { session, t } = useSession();
  const { data: day, reload } = useResource<DayView>(`/api/day?date=${session.today}`);
  const { data: tomorrow, reload: reloadTomorrow } = useResource<DayView>(`/api/day?date=${addDays(session.today, 1)}`);
  if (!day) {
    return (
      <section className="placard night">
        <p className="meta">{t.loading}</p>
      </section>
    );
  }
  // Keyed so a shutdown made elsewhere (an agent, another tab) resets the form.
  return (
    <Wrap
      key={`${day.shutdownAt}:${day.note}`}
      day={day}
      tomorrow={tomorrow}
      reload={async () => {
        await Promise.all([reload(), reloadTomorrow()]);
      }}
    />
  );
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

function Wrap({ day, tomorrow, reload }: { day: DayView; tomorrow: DayView | null; reload: () => Promise<void> }) {
  const { session, t, run, toast, refreshSession } = useSession();
  const { style } = useLook();
  const [carry, setCarry] = useState<Record<string, Carry>>({});
  const [note, setNote] = useState(day.note || '');
  const [closed, setClosed] = useState(Boolean(day.shutdownAt));
  const [moved, setMoved] = useState<{ tomorrow: number; backlog: number } | null>(null);
  const now = useClock(session.locale, session.tz);

  const done = day.tasks.filter((x) => x.done);
  const open = day.tasks.filter((x) => !x.done);
  const where = (id: string): Carry => carry[id] || 'tomorrow';
  const moving = open.filter((x) => where(x.id) !== 'keep').length;
  const worked = done.reduce((s, x) => s + (x.estimate || 0), 0);
  const weekday = capitalize(weekdayName(day.date, session.locale));
  const choices: Carry[] = ['tomorrow', 'backlog', 'keep'];
  const label = (c: Carry) => {
    const word = c === 'tomorrow' ? t.tomorrow : c === 'backlog' ? t.backlog : style === 'notebook' ? t.keepToday : t.keep;
    return style === 'notebook' ? word.toLowerCase() : word;
  };

  const close = () =>
    run(async () => {
      const r = await api<{ summary: string }>('/api/shutdown', { method: 'POST', body: { date: day.date, note, carry } });
      setMoved({ tomorrow: open.filter((x) => where(x.id) === 'tomorrow').length, backlog: open.filter((x) => where(x.id) === 'backlog').length });
      toast(r.summary);
      setClosed(true);
      await refreshSession(); // the room may turn to Nocturne
    }, reload);
  const reopen = () => setClosed(false);

  const frameNote = session.frame ? (
    <span className="meta with-icon" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <FrameIcon />
      {closed ? t.tomorrowOnFrame : t.frameNote}
    </span>
  ) : (
    <span />
  );

  if (closed && !open.length) {
    const closedAt = timeIn(day.shutdownAt, session.tz, session.locale) || now;
    const waiting = tomorrow?.tasks.filter((x) => !x.done) || [];
    return (
      <section className="placard night" aria-label={t.shutDown}>
        {style === 'notebook' ? (
          <Masthead title={t.goodNight} sub={`${t.doneDay} ${t.stepAway}`} />
        ) : style === 'timetable' ? (
          <Masthead numeral={t.doneShort} title={t.stepAway} sub={fill(t.closedAt, { time: closedAt })} />
        ) : (
          <Masthead title={t.doneDay} sub={`${t.stepAway} ${fill(t.closedAt, { time: closedAt })}`} />
        )}

        {style === 'notebook' ? (
          <p className="sentence">{wrapLine(day.tasks, moved ? moved.tomorrow + moved.backlog : 0, session.locale)}</p>
        ) : (
          <div className="tally">
            <div>
              <span>{t.doneHead}</span>
              <strong>
                {done.length} · {minutesLabel(worked)}
              </strong>
            </div>
            <div>
              <span>{t.waitingTomorrow}</span>
              <strong>{waiting.length}</strong>
            </div>
            {moved && moved.backlog > 0 && (
              <div>
                <span>{t.toBacklog}</span>
                <strong>{moved.backlog}</strong>
              </div>
            )}
          </div>
        )}

        {style === 'timetable' && waiting.length > 0 && (
          <div>
            <div className="section-head">
              <span className="label">{t.waitingTomorrow}</span>
              <span className="meta">{capitalize(weekdayName(addDays(day.date, 1), session.locale))}</span>
            </div>
            {waiting.slice(0, 4).map((x) => (
              <div key={x.id} className="done-row">
                <span className="name">{x.title}</span>
                <span className="est">{x.estimate ? minutesLabel(x.estimate) : ''}</span>
              </div>
            ))}
          </div>
        )}

        {day.note && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {style !== 'notebook' && <span className="label">{t.journalHead}</span>}
            <p className="quote">{style === 'notebook' ? `“${day.note}”` : day.note}</p>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginTop: 'auto' }}>
          {frameNote}
          {style === 'notebook' ? (
            <button type="button" className="link-btn" style={{ fontSize: 16, textDecoration: 'underline' }} onClick={reopen}>
              {t.reopen}
            </button>
          ) : (
            <button type="button" className="pill" onClick={reopen}>
              {t.reopen}
            </button>
          )}
        </div>
      </section>
    );
  }

  const recap = style === 'notebook' && worked ? `${fill(t.finished, { n: done.length, total: day.tasks.length })} ${capitalize(hoursSaid(worked, session.locale))}.` : wrapLine(day.tasks, closed ? 0 : moving, session.locale);

  return (
    <section className="placard night" aria-label={t.shutDown}>
      {style === 'notebook' ? (
        <Masthead title={fill(t.evening, { day: weekday })} sub={now} />
      ) : style === 'timetable' ? (
        <Masthead numeral={now.replace(/\s?[ap]\.?\s?m\.?$/i, '')} title={t.wrapped} sub={`${weekday} ${dayNum(day.date)}`} />
      ) : (
        <Masthead title={t.wrapped} sub={`${capitalize(longDate(day.date, session.locale))} · ${now}`} />
      )}

      <p className="recap">{recap}</p>

      {style === 'timetable' && day.tasks.some((x) => x.estimate) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="day-blocks" aria-hidden>
            {day.tasks
              .filter((x) => x.estimate)
              .map((x) => (
                <i key={x.id} className={x.done ? '' : 'open'} style={{ flex: x.estimate || 1 }} />
              ))}
          </div>
          <div className="legend">
            <span>
              <i style={{ background: 'var(--accent)' }} />
              {t.doneHead} {minutesLabel(worked)}
            </span>
            <span>
              <i style={{ border: '1.5px dashed var(--color-card-ink-3)' }} />
              {t.stillOpen}
            </span>
          </div>
        </div>
      )}

      <div>
        {style !== 'notebook' && (
          <div className="section-head">
            <span className="label">{t.doneHead}</span>
            <span className="meta">{fill(t.ofWork, { h: minutesLabel(worked) })}</span>
          </div>
        )}
        {!done.length && <p className="empty">–</p>}
        {done.slice(0, 4).map((x) => (
          <div key={x.id} className="done-row">
            <Tick />
            <span className="name">
              {x.title}
              {x.source && <span className="meta"> · {x.source.key}</span>}
            </span>
            <span className="est">{x.estimate ? minutesLabel(x.estimate) : ''}</span>
          </div>
        ))}
        {done.length > 4 && (
          <p className="meta" style={{ margin: 0, paddingLeft: 34, fontStyle: style === 'notebook' ? 'italic' : undefined }}>
            {fill(t.andMore, { n: done.length - 4 })}
          </p>
        )}
      </div>

      {open.length > 0 && (
        <div>
          <div className="section-head">
            <span className="label">{t.stillOpen}</span>
            {style !== 'notebook' && <span className="meta">{t.whereEach}</span>}
          </div>
          {open.map((x) => (
            <div key={x.id} className="carry-row">
              <span className="name">{x.title}</span>
              <span className="choice" role="group" aria-label={x.title}>
                {choices.map((c) => (
                  <button key={c} type="button" aria-pressed={where(x.id) === c} onClick={() => setCarry((m) => ({ ...m, [x.id]: c }))}>
                    {label(c)}
                  </button>
                ))}
              </span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="label">{t.journal}</span>
        <DraftText className="journal" value={note} placeholder={t.journalPlaceholder} label={t.journal} multiline onDraft={setNote} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginTop: 'auto' }}>
        {frameNote}
        <button type="button" className="pill solid" style={{ height: 42, padding: '0 22px', fontSize: 15 }} onClick={close}>
          {t.closeTheDay}
        </button>
      </div>
    </section>
  );
}
