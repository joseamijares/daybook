'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { WeekView } from '@/lib/daybook';
import type { FrameEvent } from '@/lib/frame';
import { dayNum, dow, fmtDate, longDate, monthDay, weekdayName } from '@/lib/i18n';
import { minutesLabel } from '@/lib/time';
import { timeIn, useLook, useResource, useSession } from './client';
import { capitalize, Schedule, Workload } from './day';
import { DraftText } from './DraftText';
import { Masthead } from './Masthead';
import { useOps } from './ops';
import { AddRow, TaskRow } from './TaskRow';

export const FrameIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
    <rect x="1" y="2.5" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1.3" />
    <path d="M4.5 12.5h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

export function TodayView() {
  const { session, t } = useSession();
  const { style } = useLook();
  // /?date=YYYY-MM-DD opens another day (the week view links here).
  const [date, setDate] = useState(() => {
    const d = new URLSearchParams(window.location.search).get('date');
    return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : session.today;
  });
  const [dropAt, setDropAt] = useState<number | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const { data: week, reload } = useResource<WeekView & { events?: Record<string, FrameEvent[]> }>(`/api/week?date=${date}`);
  const ops = useOps(reload);
  const day = week?.days.find((d) => d.date === date);
  const isToday = date === session.today;
  const tags = useMemo(
    () => [...(week?.days.flatMap((d) => d.tasks) || []), ...(week?.backlog || [])].map((x) => x.tag).filter((x): x is string => Boolean(x)),
    [week],
  );

  if (!week || !day) {
    return (
      <section className="placard">
        <p className="meta">{t.loading}</p>
      </section>
    );
  }

  const tasks = day.tasks;
  const dropInto = (index: number) => {
    const id = dragId;
    setDropAt(null);
    setDragId(null);
    if (!id) return;
    const ids = tasks.map((x) => x.id).filter((x) => x !== id);
    ids.splice(Math.min(index, ids.length), 0, id);
    ops.arrange(date, ids);
  };

  const weekday = capitalize(weekdayName(date, session.locale));
  const planHref = isToday ? '/plan' : `/plan?date=${date}`;
  const linearAt = timeIn(session.linearSyncedAt, session.tz, session.locale);
  const frameAt = timeIn(session.frameSentAt, session.tz, session.locale);

  return (
    <section className="placard" aria-label={weekday}>
      <Masthead
        numeral={dayNum(date)}
        title={style === 'notebook' ? capitalize(longDate(date, session.locale)) : weekday}
        sub={style === 'notebook' ? undefined : style === 'timetable' ? capitalize(fmtDate(date, session.locale, { month: 'long', year: 'numeric' })) : capitalize(monthDay(date, session.locale))}
        actions={
          <Link className={`pill${style === 'notebook' ? '' : ' solid'}`} href={planHref}>
            {t.planTheDay}
          </Link>
        }
      />

      <div className="focus-block">
        <span className="prompt">{style === 'notebook' ? t.todayIsFor : t.focusLabel}</span>
        <DraftText
          key={`${date}:${day.focus || ''}`}
          value={day.focus || ''}
          placeholder={t.focusPlaceholder}
          label={t.dayFocusPlaceholder}
          onCommit={(next) => ops.setFocus(date, next)}
        />
      </div>

      <Schedule events={week.events?.[date] || []} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {tasks.length > 0 && <Workload day={day} />}
        <div
          className="rows"
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDropAt(null)}
          onDrop={(e) => {
            e.preventDefault();
            dropInto(dropAt ?? tasks.length);
          }}
        >
          {!tasks.length && (
            <div className="empty-plan">
              <h2>{t.nothingPlanned}</h2>
              <p>{week.backlog.length ? t.nothingPlannedLead : t.emptyDay}</p>
              <Link className="pill solid" href={planHref}>
                {t.startPlanning}
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                  <path d="M2.5 7h9M8 3.5 11.5 7 8 10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>
          )}
          {tasks.map((task, i) => (
            <TaskRow
              key={task.id}
              task={task}
              tags={tags}
              onToggle={() => ops.toggle(task)}
              onPatch={(p) => ops.patch(task.id, p)}
              onDelete={() => ops.remove(task.id)}
              moves={isToday ? ['tomorrow', 'backlog'] : ['today', 'backlog']}
              draggable
              dropBefore={dropAt === i && dragId !== task.id}
              onDragStart={() => setDragId(task.id)}
              onDragEnd={() => {
                setDragId(null);
                setDropAt(null);
              }}
              onDragOver={() => setDropAt(i)}
            />
          ))}
          <AddRow placeholder={`${t.addTask} · ${t.addHint}`} onAdd={(text) => ops.add({ text, date })} />
        </div>
      </div>

      <div className="strip">
        <div className="days">
          {week.days.map((d, i) => (
            <button
              key={d.date}
              type="button"
              className={['day', d.isToday && 'is-today', d.date === date && 'is-selected', i > 4 && 'is-weekend'].filter(Boolean).join(' ')}
              onClick={() => setDate(d.date)}
              aria-label={longDate(d.date, session.locale)}
            >
              <span className="dow">{capitalize(dow(d.date, session.locale))}</span>
              <span className="num">{dayNum(d.date)}</span>
              <span className={`hrs${d.over ? ' over' : ''}`}>{d.planned ? minutesLabel(d.planned) : '–'}</span>
            </button>
          ))}
        </div>
        <div className="foot">
          <span className="with-icon">
            {session.frame && <FrameIcon />}
            {[frameAt && `${t.frameUpdated} ${frameAt}`, linearAt && `${t.linearSynced} ${linearAt}`].filter(Boolean).join(' · ') || t.agentsHint}
          </span>
          <span style={{ display: 'flex', gap: 14 }}>
            {!isToday && (
              <button type="button" className="link-btn" onClick={() => setDate(session.today)}>
                {t.backToToday}
              </button>
            )}
            {session.frame && (
              <button type="button" className="link-btn" onClick={() => ops.sendToFrame(date)}>
                {t.syncNow}
              </button>
            )}
          </span>
        </div>
      </div>
    </section>
  );
}
