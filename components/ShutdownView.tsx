'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Carry, DayView } from '@/lib/daybook';
import { dayNum, fill, hoursSaid, longDate, weekdayName } from '@/lib/i18n';
import { lateWork, wrapLine } from '@/lib/recap';
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

const hourIn = (tz: string) =>
  Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).formatToParts(new Date()).find((p) => p.type === 'hour')?.value) % 24;

export function ShutdownView() {
  const { session, t } = useSession();
  const { data: today, reload: reloadToday } = useResource<DayView>(`/api/day?date=${session.today}`);
  const { data: tomorrow, reload: reloadTomorrow } = useResource<DayView>(`/api/day?date=${addDays(session.today, 1)}`);
  // The last day with work before today, if it was this week or so: the morning
  // after, it may never have been closed.
  const prevDate = today?.previous && today.previous >= addDays(session.today, -7) ? today.previous : null;
  const { data: prev, reload: reloadPrev } = useResource<DayView>(prevDate ? `/api/day?date=${prevDate}` : null);
  // Kept here, outside the keyed form, so the tally survives the reload after closing.
  const [moved, setMoved] = useState<Moved | null>(null);
  // The day this screen closes, once chosen or closed. Pinned so closing the
  // day before doesn't turn the screen into today's form.
  const [pinned, setPinned] = useState<string | null>(null);
  if (!today || (prevDate && prev?.date !== prevDate)) {
    return (
      <section className="placard night">
        <p className="meta">{t.loading}</p>
      </section>
    );
  }
  // Nothing done today and the day before still open: before noon, pressing
  // Shut down means closing that day, not sending today's work to tomorrow.
  const before = prevDate ? prev : null;
  const either = Boolean(before && !before.shutdownAt && !today.shutdownAt && today.doneCount === 0);
  const date = pinned && (pinned === today.date || pinned === before?.date) ? pinned : either && before && hourIn(session.tz) < 12 ? before.date : today.date;
  const late = before !== null && date === before.date;
  const day = late ? before : today;
  const other = late ? today : either ? before : null;
  // Keyed so a shutdown made elsewhere (an agent, another tab) resets the form.
  return (
    <Wrap
      key={`${day.date}:${day.shutdownAt}:${day.note}`}
      day={day}
      late={late}
      next={late ? today : tomorrow}
      rolled={late ? lateWork(today.tasks, day.date) : []}
      other={other && { date: other.date, pick: () => setPinned(other.date) }}
      pin={() => setPinned(day.date)}
      moved={moved}
      setMoved={setMoved}
      reload={async () => {
        await Promise.all([reloadToday(), reloadTomorrow(), reloadPrev()]);
      }}
    />
  );
}

interface Moved {
  tomorrow: number;
  backlog: number;
}

function useClock(locale: string, tz: string) {
  const [now, setNow] = useState(() => clockNow(locale, tz));
  useEffect(() => {
    const timer = setInterval(() => setNow(clockNow(locale, tz)), 30000);
    return () => clearInterval(timer);
  }, [locale, tz]);
  return now;
}
const clockNow = (locale: string, tz: string) =>
  new Intl.DateTimeFormat(locale === 'es' ? 'es-MX' : 'en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(new Date());

function Wrap({
  day,
  late,
  next,
  rolled,
  other,
  pin,
  moved,
  setMoved,
  reload,
}: {
  day: DayView;
  late: boolean; // closed the morning after
  next: DayView | null; // where unfinished work goes: tomorrow, or today for a day closed late
  rolled: DayView['tasks']; // a day closed late: its open work, already on today
  other: { date: string; pick: () => void } | null; // the other day this screen could close
  pin: () => void;
  moved: Moved | null;
  setMoved: (m: Moved | null) => void;
  reload: () => Promise<void>;
}) {
  const { session, t, run, toast, refreshSession } = useSession();
  const { style } = useLook();
  const [carry, setCarry] = useState<Record<string, Carry>>({});
  const [note, setNote] = useState(day.note || '');
  const [closed, setClosed] = useState(Boolean(day.shutdownAt));
  const now = useClock(session.locale, session.tz);

  const all = [...day.tasks, ...rolled];
  const done = all.filter((x) => x.done);
  const open = all.filter((x) => !x.done);
  const where = (id: string): Carry => carry[id] || 'tomorrow';
  const moving = open.filter((x) => where(x.id) !== 'keep').length;
  const worked = done.reduce((s, x) => s + (x.estimate || 0), 0);
  const weekday = capitalize(weekdayName(day.date, session.locale));
  // Closed late, the work is already on today: it stays there or goes to the backlog.
  const choices: Carry[] = late ? ['tomorrow', 'backlog'] : ['tomorrow', 'backlog', 'keep'];
  const label = (c: Carry) => {
    const word = c === 'tomorrow' ? (late ? t.today : t.tomorrow) : c === 'backlog' ? t.backlog : style === 'notebook' ? t.keepToday : t.keep;
    return style === 'notebook' ? word.toLowerCase() : word;
  };
  const switchLine = other && (
    <p className="meta" style={{ margin: 0 }}>
      {late && `${fill(t.lateNote, { day: weekdayName(day.date, session.locale) })} `}
      <button type="button" className="link-btn" onClick={other.pick}>
        {fill(t.closeInstead, { day: weekdayName(other.date, session.locale) })}
      </button>
    </p>
  );

  const close = () =>
    run(async () => {
      await api('/api/shutdown', { method: 'POST', body: { date: day.date, note, carry } });
      setMoved({ tomorrow: open.filter((x) => where(x.id) === 'tomorrow').length, backlog: open.filter((x) => where(x.id) === 'backlog').length });
      toast(wrapLine(all, moving, session.locale));
      pin();
      setClosed(true);
      await refreshSession(); // the room may turn to Nocturne
    }, reload);
  // Reopening clears the shutdown, so the room comes back from Nocturne too.
  const reopen = () =>
    run(async () => {
      await api(`/api/shutdown?date=${day.date}`, { method: 'DELETE' });
      setMoved(null);
      setClosed(false);
      await refreshSession();
    }, reload);

  // Closed late, the next step is today, not tonight's Frame.
  const frameNote = late ? (
    closed ? (
      <Link className="link-btn" href="/plan">
        {t.planTheDay}
      </Link>
    ) : (
      <span />
    )
  ) : session.frame ? (
    <span className="meta with-icon" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <FrameIcon />
      {closed ? t.tomorrowOnFrame : t.frameNote}
    </span>
  ) : (
    <span />
  );

  if (closed) {
    const closedAt = timeIn(day.shutdownAt, session.tz, session.locale) || now;
    const waiting = next?.tasks.filter((x) => !x.done) || [];
    const nextDay = next?.date ?? addDays(day.date, 1);
    return (
      <section className="placard night" aria-label={t.shutDown}>
        {late ? (
          style === 'timetable' ? (
            <Masthead numeral={t.doneShort} title={fill(t.dayClosed, { day: weekdayName(day.date, session.locale) })} sub={fill(t.closedAt, { time: closedAt })} />
          ) : (
            <Masthead title={fill(t.dayClosed, { day: weekdayName(day.date, session.locale) })} sub={fill(t.closedAt, { time: closedAt })} />
          )
        ) : style === 'notebook' ? (
          <Masthead title={t.goodNight} sub={`${t.doneDay} ${t.stepAway}`} />
        ) : style === 'timetable' ? (
          <Masthead numeral={t.doneShort} title={t.stepAway} sub={fill(t.closedAt, { time: closedAt })} />
        ) : (
          <Masthead title={t.doneDay} sub={`${t.stepAway} ${fill(t.closedAt, { time: closedAt })}`} />
        )}

        {style === 'notebook' ? (
          <p className="sentence">{wrapLine(all, moved ? moved.tomorrow + moved.backlog : 0, session.locale)}</p>
        ) : (
          <div className="tally">
            <div>
              <span>{t.doneHead}</span>
              <strong>
                {done.length} · {minutesLabel(worked)}
              </strong>
            </div>
            <div>
              <span>{late ? t.carriedToday : t.waitingTomorrow}</span>
              <strong>{waiting.length}</strong>
            </div>
            {moved && moved.backlog > 0 && (
              <div>
                <span>{t.toBacklog}</span>
                <strong>{moved.backlog}</strong>
              </div>
            )}
            {!late && open.length > 0 && (
              <div>
                <span>{t.keptToday}</span>
                <strong>{open.length}</strong>
              </div>
            )}
          </div>
        )}

        {style === 'timetable' && waiting.length > 0 && (
          <div>
            <div className="section-head">
              <span className="label">{late ? t.carriedToday : t.waitingTomorrow}</span>
              <span className="meta">{capitalize(weekdayName(nextDay, session.locale))}</span>
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

  const recap = style === 'notebook' && worked ? `${fill(t.finished, { n: done.length, total: all.length })} ${capitalize(hoursSaid(worked, session.locale))}.` : wrapLine(all, closed ? 0 : moving, session.locale);

  return (
    <section className="placard night" aria-label={t.shutDown}>
      {style === 'notebook' ? (
        <Masthead title={fill(t.evening, { day: weekday })} sub={now} />
      ) : style === 'timetable' ? (
        <Masthead numeral={now.replace(/\s?[ap]\.?\s?m\.?$/i, '')} title={t.wrapped} sub={`${weekday} ${dayNum(day.date)}`} />
      ) : (
        <Masthead title={t.wrapped} sub={`${capitalize(longDate(day.date, session.locale))} · ${now}`} />
      )}

      {switchLine}

      <p className="recap">{recap}</p>

      {style === 'timetable' && all.some((x) => x.estimate) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="day-blocks" aria-hidden>
            {all
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

      {done.length > 0 && <div>
        {style !== 'notebook' && (
          <div className="section-head">
            <span className="label">{t.doneHead}</span>
            <span className="meta">{fill(t.ofWork, { h: minutesLabel(worked) })}</span>
          </div>
        )}
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
      </div>}

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
