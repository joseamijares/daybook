'use client';

// Planning takes the whole window: the meetings in a narrow column, the day
// you are building in the middle, and only tasks to add on the right, from the
// backlog or from Linear. Write new ones at the top of the day.

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { Task, WeekView } from '@/lib/daybook';
import type { FrameEvent } from '@/lib/frame';
import { fill, hoursSaid, monthDay, weekdayName } from '@/lib/i18n';
import { parseQuickAdd } from '@/lib/quickadd';
import { minutesLabel } from '@/lib/time';
import { useLook, useResource, useSession } from './client';
import { capitalize, useMeetings } from './day';
import { DraftText } from './DraftText';
import { useOps } from './ops';
import { Handle, PlusIcon, useTaskNotes } from './TaskRow';

type Source = 'backlog' | 'linear';
const X = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
    <path d="M2 2l6 6M8 2 2 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

export function PlanView() {
  const { session, t } = useSession();
  const router = useRouter();
  const [date] = useState(() => {
    const d = new URLSearchParams(window.location.search).get('date');
    return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : session.today;
  });
  const { data: week, reload } = useResource<WeekView & { events?: Record<string, FrameEvent[]> }>(`/api/week?date=${date}`);
  const ops = useOps(reload);
  const [source, setSource] = useState<Source>('backlog');
  const [query, setQuery] = useState('');
  const [text, setText] = useState('');
  const [fresh, setFresh] = useState<string[]>([]); // added in this sitting, for Undo
  const [added, setAdded] = useState<Task[]>([]); // what moved from the right to the day
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const { list: meetings, minutes: booked } = useMeetings(week?.events?.[date] || []);

  const day = week?.days.find((d) => d.date === date);
  const pool = useMemo(() => week?.backlog || [], [week?.backlog]);
  const own = pool.filter((x) => !x.source);
  const linear = pool.filter((x) => x.source);
  const q = query.trim().toLowerCase();
  const matches = (x: Task) => !q || `${x.title} ${x.tag || ''} ${x.source?.key || ''}`.toLowerCase().includes(q);
  const candidates = (source === 'linear' ? linear : own).filter(matches);
  const ghosts = added.filter((x) => (source === 'linear') === Boolean(x.source) && !pool.some((p) => p.id === x.id) && matches(x));

  if (!week || !day) {
    return (
      <section className="placard full">
        <p className="meta" style={{ padding: 40 }}>
          {t.loading}
        </p>
      </section>
    );
  }

  const leave = () => router.push(date === session.today ? '/' : `/?date=${date}`);
  const weekday = capitalize(weekdayName(date, session.locale));
  const scale = Math.max(day.capacity, day.planned) || 1;
  const within = Math.min(day.planned, day.capacity);
  const parsed = text.trim() ? parseQuickAdd(text) : null;

  const addTask = async (task: Task) => {
    setFresh((f) => [...f, task.id]);
    setAdded((a) => [task, ...a.filter((x) => x.id !== task.id)]);
    await ops.patch(task.id, { date });
  };
  const undo = async (task: Task) => {
    setFresh((f) => f.filter((x) => x !== task.id));
    setAdded((a) => a.filter((x) => x.id !== task.id));
    await ops.patch(task.id, { date: null });
  };
  const write = async () => {
    const value = text.trim();
    if (!value) return;
    setText('');
    const created = await ops.add({ text: value, date });
    if (created && typeof created === 'object' && 'id' in created) setFresh((f) => [...f, (created as Task).id]);
  };
  const dropInto = (index: number) => {
    const id = dragId;
    setDropAt(null);
    setDragId(null);
    if (!id) return;
    const ids = day.tasks.map((x) => x.id).filter((x) => x !== id);
    ids.splice(Math.min(index, ids.length), 0, id);
    ops.arrange(date, ids);
  };

  return (
    <section className="placard full" aria-label={fill(t.planDay, { day: weekday })}>
      <header className="plan-top">
        <div className="lead">
          <h1 className="plan-title">{fill(t.planDay, { day: weekday })}</h1>
          <span className="date">{capitalize(monthDay(date, session.locale))}</span>
          <div className="focus-inline">
            <span className="label">{t.focusLabel}</span>
            <DraftText
              key={`${date}:${day.focus || ''}`}
              value={day.focus || ''}
              placeholder={t.focusPlaceholder}
              label={t.focusPlaceholder}
              onCommit={(next) => ops.setFocus(date, next)}
            />
          </div>
        </div>
        <div className="right">
          <div className={`capacity${day.over ? ' over' : ''}`}>
            <div className="numbers">
              <strong>{fill(t.ofCap, { planned: minutesLabel(day.planned), cap: minutesLabel(day.capacity) })}</strong>
              <span>{day.over ? fill(t.overOf, { over: minutesLabel(day.over) }) : fill(t.leftOf, { left: minutesLabel(day.capacity - day.planned) })}</span>
            </div>
            <div className="load" aria-hidden>
              <div className="done" style={{ width: `${(within / scale) * 100}%` }} />
              {day.over > 0 && <div className="over" style={{ width: `${(day.over / scale) * 100}%` }} />}
            </div>
          </div>
          <button type="button" className="pill solid" onClick={leave}>
            {t.donePlanning}
          </button>
          <button type="button" className="pill round" onClick={leave} aria-label={t.close}>
            <X />
          </button>
        </div>
      </header>

      <div className="plan-cols">
        <aside className="plan-col meetings" aria-label={t.meetingsHead}>
          <span className="label">{t.meetingsHead}</span>
          <span className="meta" style={{ paddingBottom: 10 }}>
            {meetings.length ? fill(t.meetingsBooked, { h: minutesLabel(booked) }) : t.noMeetings}
          </span>
          {meetings.map((m) => (
            <div key={m.key} className={`mtg ${m.state === 'live' ? 'next' : m.state}`}>
              <span className="when">
                {m.range}
                {m.state === 'next' ? ` · ${t.nextMark}` : m.state === 'live' ? ` · ${t.nowLabel}` : ''}
              </span>
              <span className="what">{m.title}</span>
            </div>
          ))}
          {session.frame && meetings.length > 0 && (
            <span className="meta" style={{ paddingTop: 10, fontSize: 12 }}>
              {t.fromCalendar}
            </span>
          )}
        </aside>

        <section className="plan-col" aria-label={t.today}>
          <div className="col-top">
            <h2>{t.today}</h2>
            <span className="meta">
              {fill(t.tasksN, { n: day.tasks.length })} · {t.dragReorder}
            </span>
          </div>
          <form
            className="write"
            onSubmit={(e) => {
              e.preventDefault();
              write();
            }}
          >
            <PlusIcon />
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`${t.writeTask}… ${t.addHint}`} aria-label={t.writeTask} autoFocus />
            {parsed && (parsed.estimate || parsed.tag) ? (
              <span className="hint">{[parsed.estimate && hoursSaid(parsed.estimate, session.locale), parsed.tag && `#${parsed.tag}`].filter(Boolean).join(' · ')}</span>
            ) : (
              <span className="kbd">Enter</span>
            )}
          </form>
          <div
            className="list"
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDropAt(null)}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData('text/plain');
              const fromPool = pool.find((x) => x.id === id);
              if (fromPool) {
                setDropAt(null);
                addTask(fromPool);
              } else dropInto(dropAt ?? day.tasks.length);
            }}
          >
            {!day.tasks.length && <p className="empty">{t.emptyDay}</p>}
            {day.tasks.map((task, i) => (
              <DayLine
                key={task.id}
                task={task}
                fresh={fresh.includes(task.id)}
                dropBefore={dropAt === i && dragId !== task.id}
                dragging={dragId === task.id}
                onDragStart={() => setDragId(task.id)}
                onDragEnd={() => {
                  setDragId(null);
                  setDropAt(null);
                }}
                onDragOver={() => setDropAt(i)}
                onUndo={() => undo(task)}
                onRemove={() => ops.patch(task.id, { date: null })}
              />
            ))}
          </div>
          <div className="col-foot">
            <span>{t.orderNote}</span>
            {day.over > 0 && <span className="warn-text">{fill(t.overNudge, { over: minutesLabel(day.over) })}</span>}
          </div>
        </section>

        <section className="plan-col" aria-label={t.addTasks}>
          <div className="col-top">
            <h2>{t.addTasks}</h2>
            <div className="switch" role="group" aria-label={t.addTasks}>
              <button type="button" aria-pressed={source === 'backlog'} onClick={() => setSource('backlog')}>
                {t.backlog} <span className="count">{own.length}</span>
              </button>
              <button type="button" aria-pressed={source === 'linear'} onClick={() => setSource('linear')}>
                {t.linear} <span className="count">{linear.length}</span>
              </button>
            </div>
          </div>
          <label className="search">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4" />
              <path d="M9.5 9.5 12.5 12.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={source === 'linear' ? t.searchLinear : t.searchBacklog} aria-label={source === 'linear' ? t.searchLinear : t.searchBacklog} />
          </label>
          <div className="list">
            {source === 'linear' && !session.linear && <p className="empty">{t.linearOff}</p>}
            {ghosts.map((task) => (
              <PickLine key={task.id} task={task} added onUndo={() => undo(task)} />
            ))}
            {candidates.map((task) => (
              <PickLine key={task.id} task={task} onAdd={() => addTask(task)} />
            ))}
            {!candidates.length && !ghosts.length && (source === 'backlog' || session.linear) && <p className="empty">{t.nothingHere}</p>}
          </div>
          <div className="col-foot">
            <span>{fill(t.showing, { n: candidates.length, total: source === 'linear' ? linear.length : own.length })}</span>
            {source === 'linear' && session.linear ? (
              <button type="button" className="link-btn" onClick={() => ops.syncLinear()}>
                {t.syncLinear}
              </button>
            ) : (
              <a className="link-btn" href="/backlog">
                {t.openBacklog}
              </a>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

// A task on the day being planned: drag it, see where it came from, remove it.
function DayLine({
  task,
  fresh,
  dropBefore,
  dragging,
  onDragStart,
  onDragEnd,
  onDragOver,
  onUndo,
  onRemove,
}: {
  task: Task;
  fresh: boolean;
  dropBefore: boolean;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: () => void;
  onUndo: () => void;
  onRemove: () => void;
}) {
  const { t } = useSession();
  const { style } = useLook();
  const { carried } = useTaskNotes(task, true);
  return (
    <div
      className={['line-row', fresh && 'is-new', dropBefore && 'drop-before', dragging && 'dragging'].filter(Boolean).join(' ')}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', task.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver();
      }}
    >
      <span className="handle">
        <Handle />
      </span>
      <span className="name">{task.title}</span>
      {fresh ? (
        <span className="note fresh">
          {t.justAdded} ·{' '}
          <button type="button" onClick={onUndo}>
            {t.undo}
          </button>
        </span>
      ) : (
        <>
          {carried && <span className="note carried">{carried}</span>}
          {task.source && (
            <a className="note key" href={task.source.url} target="_blank" rel="noreferrer">
              {task.source.key}
            </a>
          )}
          {task.tag && <span className={`note${style === 'notebook' ? ' tagged' : ''}`}>{style === 'notebook' ? `#${task.tag}` : capitalize(task.tag)}</span>}
        </>
      )}
      <span className="est">{task.estimate ? minutesLabel(task.estimate) : '–'}</span>
      <button type="button" className="icon-btn" onClick={onRemove} aria-label={`${t.moveBacklog}: ${task.title}`} title={t.moveBacklog}>
        <X />
      </button>
    </div>
  );
}

// A task you could add: from the backlog or an issue from Linear.
function PickLine({ task, added, onAdd, onUndo }: { task: Task; added?: boolean; onAdd?: () => void; onUndo?: () => void }) {
  const { t } = useSession();
  const { style } = useLook();
  const est = task.estimate ? minutesLabel(task.estimate) : null;
  return (
    <div
      className={['line-row', added ? 'is-added' : 'can-add'].join(' ')}
      draggable={!added}
      onDragStart={(e) => e.dataTransfer.setData('text/plain', task.id)}
    >
      {added ? (
        <span className="add-circle" aria-hidden>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="9.5" fill="var(--color-card-ink-3)" />
            <path d="M6 10.2 8.6 12.8 14 7.4" stroke="var(--sheet)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      ) : (
        <button type="button" className="add-circle" onClick={onAdd} aria-label={`${t.addToday}: ${task.title}`}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
            <circle className="ring" cx="10" cy="10" r="8.75" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2.5" />
            <path className="cross" d="M10 6.5v7M6.5 10h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}
      {task.source && <span className="note key">{task.source.key}</span>}
      <span className="name">{task.title}</span>
      {added ? (
        <span className="note fresh">
          {t.onToday} ·{' '}
          <button type="button" onClick={onUndo}>
            {t.undo}
          </button>
        </span>
      ) : task.source?.state ? (
        <span className="note">{task.source.state}</span>
      ) : (
        task.tag && <span className={`note${style === 'notebook' ? ' tagged' : ''}`}>{style === 'notebook' ? `#${task.tag}` : capitalize(task.tag)}</span>
      )}
      {!added && (
        <button type="button" className="add-pill" onClick={onAdd}>
          {est ? fill(t.addWithTime, { time: est }) : t.addPlain}
        </button>
      )}
      <span className="est">{est || '–'}</span>
    </div>
  );
}
