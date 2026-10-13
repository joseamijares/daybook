'use client';

import { useMemo, useState } from 'react';
import type { Task, WeekView } from '@/lib/daybook';
import { dayNum, dow, longDate } from '@/lib/i18n';
import { minutesLabel } from '@/lib/time';
import { timeIn, useResource, useSession } from './client';
import { DraftText } from './DraftText';
import { useOps } from './ops';
import { AddRow, TaskRow } from './TaskRow';

export function TodayView() {
  const { session, t } = useSession();
  // /?date=YYYY-MM-DD opens another day (the week view links here).
  const [date, setDate] = useState(() => {
    const d = new URLSearchParams(window.location.search).get('date');
    return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : session.today;
  });
  const [planning, setPlanning] = useState(false);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const { data: week, reload } = useResource<WeekView>(`/api/week?date=${date}`);
  const ops = useOps(reload);
  const day = week?.days.find((d) => d.date === date);
  const isToday = date === session.today;

  const inbox = useMemo(() => {
    const list = week?.backlog || [];
    return [...list.filter((x) => x.source), ...list.filter((x) => !x.source)];
  }, [week?.backlog]);
  const linearCount = inbox.filter((x) => x.source).length;

  if (!week || !day) {
    return (
      <section className="placard">
        <p className="meta">{t.loading}</p>
      </section>
    );
  }

  const tasks = day.tasks;
  const pct = (m: number) => `${Math.min(100, (m / day.capacity) * 100)}%`;
  const doneMin = tasks.filter((x) => x.done).reduce((s, x) => s + (x.estimate || 0), 0);

  const dropInto = (index: number) => {
    const id = dragId;
    setDropAt(null);
    setDragId(null);
    if (!id) return;
    const ids = tasks.map((x) => x.id).filter((x) => x !== id);
    ids.splice(Math.min(index, ids.length), 0, id);
    ops.arrange(date, ids);
  };

  // A short day leaves room to suggest what to pull in; planning shows everything.
  const shown = planning ? inbox : tasks.length < 5 ? inbox.slice(0, 3) : [];
  const heading = isToday ? t.today : dow(date, session.locale);
  const linearAt = timeIn(session.linearSyncedAt, session.tz, session.locale);
  const frameAt = timeIn(session.frameSentAt, session.tz, session.locale);

  return (
    <section className="placard" aria-label={heading}>
      <div>
        <p className="eyebrow">{longDate(date, session.locale)}</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
          <h1 className="big">{heading}</h1>
          <button type="button" className={`pill${planning ? ' solid' : ''}`} onClick={() => setPlanning((p) => !p)}>
            {planning ? t.donePlanning : t.planTheDay}
          </button>
        </div>
      </div>

      <DraftText
        key={`${date}:${planning}:${day.focus || ''}`}
        value={day.focus || ''}
        placeholder={t.focusPlaceholder}
        autoFocus={planning}
        label={t.dayFocusPlaceholder}
        onCommit={(next) => ops.setFocus(date, next)}
      />

      <div>
        <div className="section-head">
          <span className="label">{t.toDo}</span>
          <span className="meta" style={day.over ? { color: 'var(--color-amber)' } : undefined}>
            {minutesLabel(day.planned)} {t.of} {minutesLabel(day.capacity)} · {day.doneCount} {t.of} {tasks.length} {t.done}
          </span>
        </div>
        <div className={`load${day.over ? ' over' : ''}`} style={{ marginTop: 0 }}>
          <div className="done" style={{ width: pct(doneMin) }} />
          <div className="todo" style={{ width: pct(day.planned - doneMin) }} />
        </div>
        <div
          className="rows"
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDropAt(null)}
          onDrop={(e) => {
            e.preventDefault();
            dropInto(dropAt ?? tasks.length);
          }}
          style={{ paddingTop: 4 }}
        >
          {!tasks.length && <p className="empty">{t.emptyDay}</p>}
          {tasks.map((task, i) => (
            <TaskRow
              key={task.id}
              task={task}
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
          <AddRow placeholder={`${t.addTask}  ·  ${t.addHint}`} onAdd={(text) => ops.add({ text, date })} />
        </div>
      </div>

      {(shown.length > 0 || planning) && (
        <div className="inbox">
          <div className="section-head">
            <span className="label">{linearCount && !planning ? t.fromLinear : t.fromBacklog}</span>
            <span className="meta" style={{ display: 'flex', gap: 12 }}>
              {planning && session.linear && (
                <button type="button" className="link-btn" onClick={() => ops.syncLinear()}>
                  {t.syncLinear}
                </button>
              )}
              <a className="link-btn" href="/backlog">
                {inbox.length} · {t.seeAll}
              </a>
            </span>
          </div>
          <div className="rows">
            {!inbox.length && <p className="empty">{t.emptyBacklog}</p>}
            {shown.map((task) => (
              <InboxRow key={task.id} task={task} onPull={() => ops.patch(task.id, { date })} onDragStart={() => setDragId(task.id)} />
            ))}
          </div>
        </div>
      )}

      <div className="strip">
        <div className="days">
          {week.days.map((d) => {
            const weekend = [5, 6].includes(week.days.indexOf(d));
            return (
              <button
                key={d.date}
                type="button"
                className={['day', d.isToday && 'is-today', d.date === date && 'is-selected', weekend && 'is-weekend'].filter(Boolean).join(' ')}
                onClick={() => setDate(d.date)}
                aria-label={longDate(d.date, session.locale)}
              >
                <span className="dow">{dow(d.date, session.locale)}</span>
                <span className="num">{dayNum(d.date)}</span>
                <span className={`hrs${d.over ? ' over' : ''}`}>{d.planned ? minutesLabel(d.planned).replace(' ', '') : '–'}</span>
              </button>
            );
          })}
        </div>
        <div className="foot">
          <span>
            {[linearAt && `${t.linearSynced} ${linearAt}`, frameAt && `${t.frameUpdated} ${frameAt}`].filter(Boolean).join(' · ') || t.agentsHint}
          </span>
          <span style={{ display: 'flex', gap: 14 }}>
            {!isToday && (
              <button type="button" className="link-btn" onClick={() => setDate(session.today)}>
                {t.backToToday}
              </button>
            )}
            {session.frame && (
              <button type="button" className="link-btn" onClick={() => ops.sendToFrame(date)}>
                {t.sendToFrame}
              </button>
            )}
          </span>
        </div>
      </div>
    </section>
  );
}

function InboxRow({ task, onPull, onDragStart }: { task: Task; onPull: () => void; onDragStart: () => void }) {
  return (
    <div
      className="row"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', task.id);
        onDragStart();
      }}
    >
      <button type="button" className="plus" onClick={onPull} aria-label={`+ ${task.title}`}>
        +
      </button>
      <span className="title">{task.title}</span>
      {task.source ? (
        <a className="tag linear" href={task.source.url} target="_blank" rel="noreferrer">
          {task.source.key}
        </a>
      ) : (
        <span className="tag">{task.tag || ''}</span>
      )}
      <span className="est" style={{ color: 'var(--color-card-ink-2)' }}>
        {task.estimate ? minutesLabel(task.estimate) : ''}
      </span>
    </div>
  );
}
