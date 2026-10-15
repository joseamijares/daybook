'use client';

// Planning takes the whole window: the meetings in a narrow column, the day
// you are building in the middle, and only tasks to add on the right, from the
// backlog or from Linear. Write new ones at the top of the day, or into the
// backlog; open a task to edit it, and delete backlog tasks you won't do.

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { type KeyboardEvent, useMemo, useState } from 'react';
import type { Task, WeekView } from '@/lib/daybook';
import type { FrameEvent } from '@/lib/frame';
import { fill, hoursSaid, monthDay, weekdayName } from '@/lib/i18n';
import { parseQuickAdd } from '@/lib/quickadd';
import { placeAt } from '@/lib/order';
import { addDays, minutesLabel } from '@/lib/time';
import { useLook, useResource, useSession } from './client';
import { capitalize, useMeetings } from './day';
import { DraftText } from './DraftText';
import { useOps } from './ops';
import { arranged, type SortRow, TASK_TYPE, useSortable } from './sortable';
import { AddRow, Editor, Handle, type Move, type Patch, PlusIcon, useTaskNotes } from './TaskRow';

type Source = 'backlog' | 'linear';
const X = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
    <path d="M2 2l6 6M8 2 2 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);
const Bin = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
    <path d="M2.5 4h9M5.5 4V2.5h3V4M3.75 4l.6 7.5h5.3l.6-7.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// A title you can open: click or Enter shows the editor under the row.
const opener = (open: boolean, toggle: () => void) => ({
  role: 'button',
  tabIndex: 0,
  'aria-expanded': open,
  onClick: toggle,
  onKeyDown: (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
  },
});

export function PlanView() {
  const { session, t } = useSession();
  const router = useRouter();
  // /plan?date=YYYY-MM-DD plans another day; no date plans today.
  const urlDate = useSearchParams().get('date');
  const date = urlDate && /^\d{4}-\d{2}-\d{2}$/.test(urlDate) ? urlDate : session.today;
  const { data: week, reload, setData } = useResource<WeekView & { events?: Record<string, FrameEvent[]> }>(`/api/week?date=${date}`);
  const ops = useOps(reload);
  const [source, setSource] = useState<Source>('backlog');
  const [query, setQuery] = useState('');
  const [text, setText] = useState('');
  const [fresh, setFresh] = useState<string[]>([]); // added in this sitting, for Undo
  const [added, setAdded] = useState<Task[]>([]); // what moved from the right to the day
  const { list: meetings, minutes: booked } = useMeetings(week?.events?.[date] || []);

  const day = week?.days.find((d) => d.date === date);
  const pool = useMemo(() => week?.backlog || [], [week?.backlog]);
  const own = pool.filter((x) => !x.source);
  const linear = pool.filter((x) => x.source);
  const q = query.trim().toLowerCase();
  const matches = (x: Task) => !q || `${x.title} ${x.tag || ''} ${x.source?.key || ''}`.toLowerCase().includes(q);
  const candidates = (source === 'linear' ? linear : own).filter(matches);
  const tags = [...(week?.days.flatMap((d) => d.tasks) || []), ...pool].map((x) => x.tag).filter((x): x is string => Boolean(x));
  const ids = (day?.tasks || []).map((x) => x.id);

  // Moved from the right column onto the day: shown as just added, with Undo.
  const take = (task: Task) => {
    setFresh((f) => [...f, task.id]);
    setAdded((a) => [task, ...a.filter((x) => x.id !== task.id)]);
  };
  // Drag to reorder the day, or drag a task in from the right column onto a
  // line. The new order shows at once and saves behind.
  const sort = useSortable({
    ids,
    accepts: (id) => pool.some((x) => x.id === id),
    onMove: (id, index) => {
      const next = placeAt(ids, id, index);
      const incoming = pool.find((x) => x.id === id);
      if (incoming) take(incoming);
      setData((w) => w && arranged(w, date, next));
      ops.arrange(date, next);
    },
  });
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
  // Not capitalised: Spanish writes weekdays in lower case mid-sentence ("Planear el martes").
  const weekday = weekdayName(date, session.locale);
  const scale = Math.max(day.capacity, day.planned) || 1;
  const within = Math.min(day.planned, day.capacity);
  const parsed = text.trim() ? parseQuickAdd(text) : null;
  // Moves offered when you open a task on the day: never to the day itself.
  const moves = (['today', 'tomorrow', 'backlog'] as Move[]).filter((m) => m === 'backlog' || (m === 'today' ? session.today : addDays(session.today, 1)) !== date);

  // From the right column onto the end of the day.
  const addTask = (task: Task) => {
    take(task);
    setData((w) => w && arranged(w, date, [...ids, task.id]));
    ops.patch(task.id, { date });
  };
  // No longer "just added": Undo, a move off this day or a delete. Otherwise a
  // task that left the day would linger on the right as "On today", with an Undo.
  const forget = (id: string) => {
    setFresh((f) => f.filter((x) => x !== id));
    setAdded((a) => a.filter((x) => x.id !== id));
  };
  const undo = async (task: Task) => {
    forget(task.id);
    await ops.patch(task.id, { date: null });
  };
  // run() answers undefined when the change failed (and says why in a toast).
  const thenForget = async (id: string, change: Promise<unknown>) => {
    if ((await change) !== undefined) forget(id);
  };
  const write = async () => {
    const value = text.trim();
    if (!value) return;
    setText('');
    const created = await ops.add({ text: value, date });
    const task = (created as { task?: Task } | undefined)?.task;
    if (task) setFresh((f) => [...f, task.id]);
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
              {(day.tasks.length === 1 ? t.oneTask : fill(t.tasksN, { n: day.tasks.length }))} · {t.dragReorder}
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
              <span className="kbd">{t.enterKey}</span>
            )}
          </form>
          <div className="list" {...sort.listProps}>
            {!day.tasks.length && <p className="empty">{t.emptyDay}</p>}
            {day.tasks.map((task) => (
              <DayLine
                key={task.id}
                task={task}
                fresh={fresh.includes(task.id)}
                sort={sort.rowProps(task.id)}
                dragging={sort.dragging === task.id}
                onUndo={() => undo(task)}
                onRemove={() => thenForget(task.id, ops.patch(task.id, { date: null }))}
                moves={moves}
                tags={tags}
                // The editor only offers moves off this day, so a new date means it left.
                onPatch={(p) => (p.date !== undefined && p.date !== date ? thenForget(task.id, ops.patch(task.id, p)) : ops.patch(task.id, p))}
                onDelete={() => thenForget(task.id, ops.remove(task.id))}
              />
            ))}
            {sort.slot && <div className="sort-slot" aria-hidden style={{ transform: `translate3d(0, ${sort.slot.top}px, 0)`, height: sort.slot.height }} />}
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
            {source === 'backlog' && <AddRow placeholder={`${t.addToBacklog}  ·  ${t.addHint}`} onAdd={(value) => ops.add({ text: value, date: null })} />}
            {source === 'linear' && !session.linear && <p className="empty">{t.linearOff}</p>}
            {ghosts.map((task) => (
              <PickLine key={task.id} task={task} added onUndo={() => undo(task)} />
            ))}
            {candidates.map((task) => (
              <PickLine
                key={task.id}
                task={task}
                tags={tags}
                onAdd={() => addTask(task)}
                // Linear owns its issues: a sync would bring a deleted one back.
                onPatch={task.source ? undefined : (p) => ops.patch(task.id, p)}
                onDelete={task.source ? undefined : () => ops.remove(task.id)}
              />
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
              <Link className="link-btn" href={`/backlog?plan=${date}`}>
                {t.openBacklog}
              </Link>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

// A task on the day being planned: drag it, see where it came from, open it
// to edit it, remove it.
function DayLine({
  task,
  fresh,
  sort,
  dragging,
  onUndo,
  onRemove,
  moves,
  tags,
  onPatch,
  onDelete,
}: {
  task: Task;
  fresh: boolean;
  sort: SortRow;
  dragging: boolean;
  onUndo: () => void;
  onRemove: () => void;
  moves: Move[];
  tags: string[];
  onPatch: (patch: Patch) => void;
  onDelete: () => void;
}) {
  const { t } = useSession();
  const { style } = useLook();
  const { carried } = useTaskNotes(task, true);
  const [open, setOpen] = useState(false);
  return (
    <>
      <div
        className={['line-row', fresh && 'is-new', dragging && 'dragging'].filter(Boolean).join(' ')}
        draggable={!open}
        {...sort}
      >
        <span className="handle">
          <Handle />
        </span>
        <span className="name opens" {...opener(open, () => setOpen((o) => !o))}>
          {task.title}
        </span>
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
      {open && <Editor task={task} tags={tags} moves={moves} onPatch={onPatch} onDelete={onDelete} onClose={() => setOpen(false)} />}
    </>
  );
}

// A task you could add: from the backlog or an issue from Linear. Your own
// backlog tasks open to be edited, and can be deleted (after asking).
function PickLine({
  task,
  added,
  tags = [],
  onAdd,
  onUndo,
  onPatch,
  onDelete,
}: {
  task: Task;
  added?: boolean;
  tags?: string[];
  onAdd?: () => void;
  onUndo?: () => void;
  onPatch?: (patch: Patch) => void;
  onDelete?: () => void;
}) {
  const { t } = useSession();
  const { style } = useLook();
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState(false);
  const est = task.estimate ? minutesLabel(task.estimate) : null;
  const editable = !added && Boolean(onPatch && onDelete);
  return (
    <>
      <div
        className={['line-row', added ? 'is-added' : asking ? 'is-asking' : 'can-add'].join(' ')}
        draggable={!added && !open && !asking}
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', task.id);
          e.dataTransfer.setData(TASK_TYPE, task.id);
          e.dataTransfer.effectAllowed = 'move';
        }}
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
        {editable ? (
          <span className="name opens" {...opener(open, () => setOpen((o) => !o))}>
            {task.title}
          </span>
        ) : (
          <span className="name">{task.title}</span>
        )}
        {asking ? (
          <span className="ask">
            <span className="note">{t.deleteQ}</span>
            <button type="button" className="btn quiet" onClick={() => setAsking(false)}>
              {t.keepIt}
            </button>
            <button type="button" className="btn danger" onClick={onDelete}>
              {t.deleteBtn}
            </button>
          </span>
        ) : added ? (
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
        {!added && !asking && (
          <button type="button" className="add-pill" onClick={onAdd}>
            {est ? fill(t.addWithTime, { time: est }) : t.addPlain}
          </button>
        )}
        {!asking && <span className="est">{est || '–'}</span>}
        {editable && !asking && (
          <button type="button" className="icon-btn" onClick={() => setAsking(true)} aria-label={`${t.deleteBtn}: ${task.title}`} title={t.deleteBtn}>
            <Bin />
          </button>
        )}
      </div>
      {open && onPatch && onDelete && <Editor task={task} tags={tags} moves={[]} onPatch={onPatch} onDelete={onDelete} onClose={() => setOpen(false)} />}
    </>
  );
}
