'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo, useReducer, useState } from 'react';
import { copyReminder } from '@/lib/copyReminder';
import type { WeekView } from '@/lib/daybook';
import type { FrameEvent } from '@/lib/frame';
import { dayNum, dow, fill, fmtDate, longDate, monthDay, weekdayName } from '@/lib/i18n';
import { placeAt } from '@/lib/order';
import { minutesLabel } from '@/lib/time';
import { copyLater, copyTimes, downloadCopy, timeIn, useLook, useResource, useSession } from './client';
import { capitalize, Schedule, Workload } from './day';
import { DraftText } from './DraftText';
import { Masthead } from './Masthead';
import { useOps } from './ops';
import { arranged, useSortable } from './sortable';
import { AddRow, TaskRow } from './TaskRow';

export const FrameIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
    <rect x="1" y="2.5" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1.3" />
    <path d="M4.5 12.5h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

const validDate = (d: string | null) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null);

export function TodayView() {
  const { session, t, run } = useSession();
  const { style } = useLook();
  const [, recheck] = useReducer((n: number) => n + 1, 0);
  // /?date=YYYY-MM-DD opens another day (the week view links here). No date
  // means today, and today moves on by itself when the day changes.
  const urlDate = useSearchParams().get('date');
  const [fromUrl, setFromUrl] = useState(urlDate);
  const [picked, setPicked] = useState(validDate(urlDate));
  if (urlDate !== fromUrl) {
    setFromUrl(urlDate);
    setPicked(validDate(urlDate));
  }
  const date = picked && picked !== session.today ? picked : session.today;
  const setDate = (d: string) => setPicked(d === session.today ? null : d);
  const { data: week, reload, setData } = useResource<WeekView & { events?: Record<string, FrameEvent[]> }>(`/api/week?date=${date}`);
  const ops = useOps(reload);
  const day = week?.days.find((d) => d.date === date);
  const ids = (day?.tasks || []).map((x) => x.id);
  // Drag to reorder: the new order shows at once and saves behind.
  const sort = useSortable({
    ids,
    onMove: (id, index) => {
      const next = placeAt(ids, id, index);
      setData((w) => w && arranged(w, date, next));
      ops.arrange(date, next);
    },
  });
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

  const weekday = capitalize(weekdayName(date, session.locale));
  const planHref = isToday ? '/plan' : `/plan?date=${date}`;
  const linearAt = timeIn(session.linearSyncedAt, session.tz, session.locale);
  const frameAt = timeIn(session.frameSentAt, session.tz, session.locale);
  // On this device the foot says where your days live, and once a week asks
  // for a copy (there are no agents or syncs to report here).
  const local = Boolean(session.local);
  // eslint-disable-next-line react-hooks/purity -- a clock read; screens refresh every minute anyway
  const copy = local ? copyReminder(copyTimes(), Date.now()) : null;
  const keepCopy = () => run(() => downloadCopy(session.today), recheck);
  const putOff = () => {
    copyLater();
    recheck();
  };

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
        <div className="rows" {...sort.listProps}>
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
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              tags={tags}
              onToggle={() => ops.toggle(task)}
              onPatch={(p) => ops.patch(task.id, p)}
              onDelete={() => ops.remove(task.id)}
              moves={isToday ? ['tomorrow', 'backlog'] : ['today', 'backlog']}
              sort={sort.rowProps(task.id)}
              dragging={sort.dragging === task.id}
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
            {(session.frame || local) && <FrameIcon />}
            {copy
              ? copy.due
                ? copy.days === null
                  ? t.copyNone
                  : fill(t.copyAgo, { days: copy.days })
                : t.dataOnDevice
              : [frameAt && `${t.frameUpdated} ${frameAt}`, linearAt && `${t.linearSynced} ${linearAt}`].filter(Boolean).join(' · ') || t.agentsHint}
          </span>
          <span style={{ display: 'flex', gap: 14 }}>
            {!isToday && (
              <button type="button" className="link-btn" onClick={() => setDate(session.today)}>
                {t.backToToday}
              </button>
            )}
            {copy?.due && (
              <>
                <button type="button" className="link-btn quiet" onClick={putOff}>
                  {t.notNow}
                </button>
                <button type="button" className="link-btn" onClick={keepCopy}>
                  {t.keepCopy}
                </button>
              </>
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
