'use client';

// Pieces of a day shared by Today and Planning: the meetings and the workload,
// each drawn the way the chosen design draws it.

import type { DayView } from '@/lib/daybook';
import type { FrameEvent } from '@/lib/frame';
import { fill, hoursSaid } from '@/lib/i18n';
import { minutesLabel } from '@/lib/time';
import { useLook, useSession } from './client';

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export interface Meeting {
  key: string;
  title: string;
  allDay: boolean;
  start: number | null;
  end: number | null;
  time: string; // "11:30"
  range: string; // "11:30 – 12:00"
  state: 'past' | 'live' | 'next' | 'later';
  soon: number | null; // minutes until it starts, when within the hour
}

// Meetings in order, with which one is next and how soon.
export function useMeetings(events: FrameEvent[]): { list: Meeting[]; minutes: number } {
  const { session, t } = useSession();
  const fmt = new Intl.DateTimeFormat(session.locale === 'es' ? 'es-MX' : 'en-US', { timeZone: session.tz, hour: 'numeric', minute: '2-digit' });
  const clock = (ms: number) => fmt.format(new Date(ms)).replace(/\s?[ap]\.?\s?m\.?$/i, '');
  // eslint-disable-next-line react-hooks/purity -- a clock read; screens refresh every minute anyway
  const now = Date.now();
  const sorted = events
    .map((e) => ({ e, start: e.start ? Date.parse(e.start) : null, end: e.end ? Date.parse(e.end) : null }))
    .sort((a, b) => (a.start ?? 0) - (b.start ?? 0));
  const minutes = sorted.reduce((sum, { e, start, end }) => sum + (start && end && !e.allDay ? Math.max(0, Math.round((end - start) / 60000)) : 0), 0);
  const nextIndex = sorted.findIndex(({ e, start }) => !e.allDay && start !== null && start > now);
  const list = sorted.map(({ e, start, end }, i) => {
      let state: Meeting['state'] = 'later';
      if (end && end <= now) state = 'past';
      else if (start && start <= now) state = 'live';
      else if (i === nextIndex) state = 'next';
      const soon = state === 'next' && start && start - now < 3600000 ? Math.max(1, Math.round((start - now) / 60000)) : null;
      return {
        key: `${e.title}${e.start}`,
        title: e.title,
        allDay: e.allDay || !start,
        start,
        end,
        time: e.allDay || !start ? t.allDay : clock(start),
        range: e.allDay || !start ? t.allDay : end ? `${clock(start)} – ${clock(end)}` : clock(start),
        state,
        soon,
      };
    });
  return { list, minutes };
}

export function Schedule({ events }: { events: FrameEvent[] }) {
  const { t } = useSession();
  const { style } = useLook();
  const { list } = useMeetings(events);
  if (!list.length) return null;
  const next = list.find((m) => m.state === 'next' || m.state === 'live');
  const count = list.length === 1 ? t.oneMeeting : `${list.length} ${t.meetings}`;

  return (
    <div className="schedule" style={{ display: 'flex', flexDirection: 'column', gap: style === 'timetable' ? 10 : 0 }}>
      {style === 'notebook' ? (
        <span className="label" style={{ paddingBottom: 6 }}>
          {capitalize(count)}
        </span>
      ) : (
        <div className="section-head" style={style === 'timetable' ? { borderBottom: 0, paddingBottom: 0 } : undefined}>
          <span className="label">{t.schedule}</span>
          <span className="meta">
            {style === 'timetable' && next ? (
              <>
                {capitalize(t.nextMark)} <strong style={{ color: 'var(--accent)' }}>{next.title}</strong>
                {next.soon ? ` ${fill(t.inMinutes, { n: next.soon })}` : ''}
              </>
            ) : (
              count
            )}
          </span>
        </div>
      )}
      {style === 'timetable' && <Timeline list={list} />}
      <div className="events">
        {list.map((m) => (
          <div key={m.key} className={`event ${m.state === 'live' ? 'next' : m.state}`}>
            <span className="time">{m.time}</span>
            <span className="what">{m.title}</span>
            {m.state === 'live' && <span className="soon">{t.nowLabel}</span>}
            {m.soon && <span className="soon">{fill(t.inMinutes, { n: m.soon })}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// The day as a line from 8 to 8, with the meetings on it and a mark for now.
function Timeline({ list }: { list: Meeting[] }) {
  const { session } = useSession();
  const timed = list.filter((m) => m.start && m.end && !m.allDay);
  if (!timed.length) return null;
  const hourOf = (ms: number) => {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: session.tz, hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date(ms));
    const h = Number(parts.find((p) => p.type === 'hour')?.value) % 24;
    return h + Number(parts.find((p) => p.type === 'minute')?.value) / 60;
  };
  const from = Math.min(8, Math.floor(Math.min(...timed.map((m) => hourOf(m.start!)))));
  const to = Math.max(20, Math.ceil(Math.max(...timed.map((m) => hourOf(m.end!)))));
  const pct = (h: number) => `${((h - from) / (to - from)) * 100}%`;
  // eslint-disable-next-line react-hooks/purity -- a clock read
  const now = hourOf(Date.now());
  const ticks = Array.from({ length: Math.floor((to - from) / 2) + 1 }, (_, i) => from + i * 2);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className="timeline" aria-hidden>
        {now > from && now < to && <span className="gone" style={{ width: pct(now) }} />}
        {timed.map((m) => (
          <i
            key={m.key}
            className={m.state === 'next' || m.state === 'live' ? 'next' : m.state === 'past' ? 'past' : ''}
            style={{ left: pct(hourOf(m.start!)), width: `calc(${pct(hourOf(m.end!))} - ${pct(hourOf(m.start!))})` }}
            title={`${m.range} ${m.title}`}
          />
        ))}
        {now > from && now < to && <span className="now" style={{ left: pct(now) }} />}
      </div>
      <div className="hours" aria-hidden>
        {ticks.map((h) => (
          <span key={h}>{h % 12 || 12}</span>
        ))}
      </div>
    </div>
  );
}

// How full the day is: a bar for the wall label, blocks of time for the
// timetable, a sentence for the notebook.
export function Workload({ day }: { day: DayView }) {
  const { t, session } = useSession();
  const { style } = useLook();
  const tasks = day.tasks;
  const doneMin = tasks.filter((x) => x.done).reduce((s, x) => s + (x.estimate || 0), 0);
  const done = `${day.doneCount} ${t.of} ${tasks.length} ${t.done}`;

  if (style === 'notebook') {
    const said = (m: number) => hoursSaid(m, session.locale);
    // "a 6-hour day" in English; "un día de 6 horas" in Spanish.
    const capSaid = day.capacity % 60 ? said(day.capacity) : fill(t.hourDay, { n: day.capacity / 60 });
    return (
      <p className="sentence">
        {fill(t.plannedFor, { planned: capitalize(said(day.planned)), cap: capSaid })}{' '}
        {day.over > 0 ? (
          <span className="warn-text">{fill(t.tooMany, { over: said(day.over) })}</span>
        ) : day.capacity > day.planned ? (
          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{fill(t.roomFor, { left: said(day.capacity - day.planned) })}</span>
        ) : null}{' '}
        <span style={{ color: 'var(--color-card-ink-2)' }}>{capitalize(done)}.</span>
      </p>
    );
  }

  if (style === 'timetable') {
    const scale = Math.max(day.capacity * (8 / 6), day.planned);
    const timed = tasks.filter((x) => x.estimate);
    const ends = timed.map((_, i) => timed.slice(0, i + 1).reduce((s, x) => s + (x.estimate || 0), 0));
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="section-head" style={{ borderBottom: 0, paddingBottom: 0 }}>
          <span className="label">{t.toDo}</span>
          <span className="meta">
            {done} ·{' '}
            {day.over ? (
              <span className="warn">{fill(t.overOf, { over: minutesLabel(day.over) })}</span>
            ) : (
              fill(t.leftOf, { left: minutesLabel(Math.max(0, day.capacity - day.planned)) })
            )}
          </span>
        </div>
        <div className="blocks" aria-hidden>
          {timed.map((x, i) => (
            <i key={x.id} className={x.done ? 'done' : ends[i] > day.capacity ? 'past' : ''} style={{ width: `${((x.estimate || 0) / scale) * 100}%` }} title={x.title} />
          ))}
          <span className="cap" style={{ left: `${(day.capacity / scale) * 100}%` }} />
        </div>
        <div className="blocks-scale" aria-hidden>
          <span style={{ left: `${(day.capacity / scale) * 100}%` }}>
            {minutesLabel(day.capacity)} {t.dayCap}
          </span>
        </div>
      </div>
    );
  }

  const scale = Math.max(day.capacity, day.planned) || 1;
  const within = Math.min(day.planned, day.capacity);
  const doneW = Math.min(doneMin, within);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="section-head" style={{ borderBottom: 0, paddingBottom: 0 }}>
        <span className="label">{t.toDo}</span>
        <span className="meta">
          <strong className={day.over ? 'warn' : undefined}>{fill(t.ofCap, { planned: minutesLabel(day.planned), cap: minutesLabel(day.capacity) })}</strong> · {done}
        </span>
      </div>
      <div className="load" aria-hidden>
        <div className="done" style={{ width: `${(doneW / scale) * 100}%` }} />
        <div className="todo" style={{ width: `${((within - doneW) / scale) * 100}%` }} />
        {day.over > 0 && <div className="over" style={{ width: `${(day.over / scale) * 100}%` }} />}
      </div>
    </div>
  );
}
