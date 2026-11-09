'use client';

import { type KeyboardEvent, useRef, useState } from 'react';
import type { Subtask, Task } from '@/lib/daybook';
import { dow, fill, type Strings, weekdayName } from '@/lib/i18n';
import { minutesLabel } from '@/lib/time';
import { useLook, useSession } from './client';
import type { SortRow } from './sortable';

export function Check({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" className={`check${on ? ' on' : ''}`} onClick={onClick} aria-pressed={on} aria-label={label}>
      {on && (
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
          <path d="M2.5 6.2L5 8.5L9.5 3.5" stroke="var(--sheet)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

export const PlusIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden>
    <path d="M7 1.5v11M1.5 7h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

export const X = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
    <path d="M2 2l6 6M8 2 2 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

// Which tasks show their subtasks on the row, remembered on this device.
const PEEK_KEY = 'daybook.peek';
function peeking(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(PEEK_KEY) || '[]') as string[]);
  } catch {
    return new Set();
  }
}
function setPeeking(id: string, on: boolean) {
  try {
    const ids = peeking();
    if (on) ids.add(id);
    else ids.delete(id);
    localStorage.setItem(PEEK_KEY, JSON.stringify([...ids].slice(-200)));
  } catch {
    // A private window keeps it for this page only.
  }
}

/** Whether a task shows its subtasks on its row (on this device), and a way to change it. */
export function usePeek(task: Task) {
  // Rows render only once the day has loaded in the browser, so this reads no storage on the server.
  const [peek, setPeek] = useState(() => peeking().has(task.id));
  const set = (on: boolean) => {
    setPeek(on);
    setPeeking(task.id, on);
  };
  return [peek, set] as const;
}

/** The subtask count as a toggle: shows the subtasks under the row; it never opens the task. */
export function SubsToggle({ count, open, onToggle, className = 'subs' }: { count: string; open: boolean; onToggle: () => void; className?: string }) {
  const { t } = useSession();
  return (
    <button
      type="button"
      className={`${className} subs-toggle`}
      aria-expanded={open}
      aria-label={`${open ? t.hideSubtasks : t.showSubtasks}: ${count}`}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      <Chevron open={open} />
      {count}
    </button>
  );
}

export const Chevron = ({ open }: { open: boolean }) => (
  <svg className={`chevron${open ? ' open' : ''}`} width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
    <path d="M3.5 2l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Marks a subtask count where it stands without words around it. */
export const ListIcon = () => (
  <svg className="list-icon" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
    <path d="M2 3h8M2 6h8M2 9h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

export const Handle = () => (
  <svg width="8" height="12" viewBox="0 0 8 12" aria-hidden>
    {[2, 6, 10].map((y) => (
      <g key={y} fill="currentColor">
        <circle cx="2" cy={y} r="1.2" />
        <circle cx="6" cy={y} r="1.2" />
      </g>
    ))}
  </svg>
);

export type Move = 'today' | 'tomorrow' | 'backlog';

/** What an open task needs to change its subtasks (from useOps). Each call saves at once. */
export interface SubtaskOps {
  addSubtask: (taskId: string, title: string) => unknown;
  patchSubtask: (taskId: string, id: string, body: { title?: string; done?: boolean }) => unknown;
  removeSubtask: (taskId: string, id: string) => unknown;
}

/** "2 of 4 subtasks", or "4 subtasks" when none are done. Where rows are one line, always "2 of 4". */
export function subtaskCount(task: Task, t: Strings, short = false): string | null {
  const n = task.subtasks?.length || 0;
  if (!n) return null;
  const done = task.subtasks.filter((s) => s.done).length;
  if (short) return fill(t.subtasksDoneShort, { done, n });
  if (!done) return n === 1 ? t.oneSubtask : fill(t.subtasksN, { n });
  return fill(t.subtasksDone, { done, n });
}
export type Patch = { title?: string; date?: string | null; tag?: string | null; estimate?: number | null };

interface Props {
  task: Task;
  onToggle: () => void;
  onPatch: (patch: Patch) => void;
  onDelete: () => void;
  moves?: Move[];
  /** Tags used elsewhere, offered when tagging. */
  tags?: string[];
  /** From useSortable: lets the row be dragged within its list. */
  sort?: SortRow;
  subtaskOps?: SubtaskOps;
}

// "45m", "1h30", "1.5h", "90" → minutes; "" → no estimate; anything else → undefined.
export function readMinutes(s: string): number | null | undefined {
  const v = s.trim().toLowerCase().replace(',', '.');
  if (!v) return null;
  const h = v.match(/^(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hours?)(?:\s*(\d{1,2})\s*(?:m|min|mins|minutes?)?)?$/);
  if (h) return Math.round(parseFloat(h[1]) * 60) + (h[2] ? Number(h[2]) : 0);
  const m = v.match(/^(\d{1,4})\s*(?:m|min|mins|minutes?)?$/);
  return m ? Number(m[1]) : undefined;
}

// What a task carries besides its title, in words: its tag, where it came
// from, and whether it has been waiting since an earlier day.
export function useTaskNotes(task: Task, short = false) {
  const { t, session } = useSession();
  const { style } = useLook();
  const rolled = task.rolledFrom && !task.done && task.rolledFrom !== task.date ? task.rolledFrom : null;
  let carried: string | null = null;
  if (rolled) {
    carried = style === 'timetable' || short ? fill(t.since, { day: dow(rolled, session.locale) }) : fill(t.carriedFrom, { day: weekdayName(rolled, session.locale) });
    if (style === 'notebook') carried = carried.charAt(0).toLowerCase() + carried.slice(1);
  }
  const linearState = task.source?.state ? fill(t.inLinear, { state: task.source.state }) : null;
  return { carried, linearState };
}

export function TaskRow({ task, onToggle, onPatch, onDelete, moves = ['tomorrow', 'backlog'], tags = [], sort, subtaskOps }: Props) {
  const [open, setOpen] = useState(false);
  const [peek, setPeek] = usePeek(task);
  const showPeek = peek && !open && Boolean(subtaskOps) && task.subtasks.length > 0;
  const { t } = useSession();
  const { style } = useLook();
  const { carried, linearState } = useTaskNotes(task);
  const subs = subtaskCount(task, t, style === 'timetable');

  const meta: React.ReactNode[] = [];
  if (task.tag) meta.push(<span key="tag" className="tag">{task.tag}</span>);
  if (subs)
    meta.push(
      subtaskOps ? (
        <SubsToggle
          key="subs"
          count={subs}
          open={showPeek}
          onToggle={() => {
            setPeek(!showPeek);
            if (!showPeek) setOpen(false);
          }}
        />
      ) : (
        <span key="subs" className="subs">
          <ListIcon />
          {subs}
        </span>
      ),
    );
  if (task.source) {
    meta.push(
      <a key="key" className="key" href={task.source.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
        {task.source.key}
      </a>,
    );
    if (linearState && !task.done) meta.push(<span key="state">{linearState}</span>);
  }
  if (carried) meta.push(<span key="carried" className="carried">{carried}</span>);

  const toggleOpen = () => setOpen((o) => !o);
  const onKey = (e: KeyboardEvent) => {
    if (e.target !== e.currentTarget) return; // a link inside (Linear) keeps its own keys
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleOpen();
    }
  };

  return (
    <>
      <div className={['row', 'hoverable', task.done && 'is-done', showPeek && 'peeking'].filter(Boolean).join(' ')} {...sort}>
        <Check on={task.done} onClick={onToggle} label={task.title} />
        <div className="body" role="button" tabIndex={0} aria-expanded={open} onClick={toggleOpen} onKeyDown={onKey}>
          <span className="line">
            {/* The strike sits on an inline span so it runs through every line of a long title. */}
            <span className="name">
              <span className={`strike${task.done ? ' is-done' : ''}`}>{task.title}</span>
            </span>
            {task.tag && <span className="hashtag">#{task.tag}</span>}
          </span>
          {meta.length > 0 && (
            <span className="meta-line">
              {meta.flatMap((m, i) => (i ? [<span key={`s${i}`} className="sep">·</span>, m] : [m]))}
            </span>
          )}
        </div>
        <span className="est">{task.estimate ? minutesLabel(task.estimate) : ''}</span>
      </div>
      {open && <Editor task={task} tags={tags} moves={moves} onPatch={onPatch} onDelete={onDelete} onClose={() => setOpen(false)} subtaskOps={subtaskOps} />}
      {showPeek && subtaskOps && <Peek task={task} ops={subtaskOps} />}
    </>
  );
}

// A task's subtasks shown under its row, to tick off without opening the task.
// Adding, renaming and removing stay in the open task.
export function Peek({ task, ops }: { task: Task; ops: SubtaskOps }) {
  // A tick shows at once, over the task as last loaded. When the task comes
  // back the ticks are dropped (it has them); a tick whose save failed is
  // taken back, unless a later tick on the same subtask has replaced it, so
  // the box never shows what wasn't saved.
  type Tick = { done: boolean; n: number };
  const [ticks, setTicks] = useState<{ from: Subtask[]; by: Record<string, Tick> }>({ from: task.subtasks, by: {} });
  const count = useRef(0);
  let by = ticks.by;
  if (ticks.from !== task.subtasks) {
    by = {};
    setTicks({ from: task.subtasks, by });
  }
  const list = task.subtasks.map((s) => (by[s.id] ? { ...s, done: by[s.id].done } : s));
  const tick = async (s: Subtask) => {
    const mine: Tick = { done: !s.done, n: (count.current += 1) };
    setTicks((x) => ({ ...x, by: { ...x.by, [s.id]: mine } }));
    const saved = await ops.patchSubtask(task.id, s.id, { done: mine.done });
    if (saved === undefined)
      setTicks((x) => {
        if (x.by[s.id]?.n !== mine.n) return x; // a later tick stands
        const next = { ...x.by };
        delete next[s.id];
        return { ...x, by: next };
      });
  };
  return (
    <div className="peek">
      {list.map((s) => (
        <div key={s.id} className={`peek-item${s.done ? ' is-done' : ''}`}>
          <Check on={s.done} label={s.title} onClick={() => tick(s)} />
          {/* A bigger target for the pointer; the check is the control for keys and screen readers. */}
          <button type="button" className="peek-title" onClick={() => tick(s)} tabIndex={-1} aria-hidden>
            {s.title}
          </button>
        </div>
      ))}
    </div>
  );
}

// An open task, in place: rename it, tag it, time it, move it or delete it.
// Enter saves; Escape or the close button leaves it as it was.
export function Editor({
  task,
  tags,
  moves,
  onPatch,
  onDelete,
  onClose,
  subtaskOps,
}: {
  task: Task;
  tags: string[];
  moves: Move[];
  onPatch: (patch: Patch) => void;
  onDelete: () => void;
  onClose: () => void;
  subtaskOps?: SubtaskOps;
}) {
  const { t } = useSession();
  const [title, setTitle] = useState(task.title);
  const [tag, setTag] = useState(task.tag || '');
  const [time, setTime] = useState(task.estimate ? minutesLabel(task.estimate).replace(' ', '') : '');
  const [asking, setAsking] = useState(false);
  const [badTime, setBadTime] = useState(false);
  const recent = [...new Set(tags)].filter((x) => x && x !== tag).slice(0, 5);

  const save = () => {
    const patch: Patch = {};
    if (title.trim() && title.trim() !== task.title) patch.title = title.trim();
    const nextTag = tag.trim().replace(/^#/, '').replace(/\s+/g, '-').slice(0, 40) || null;
    if (nextTag !== (task.tag || null)) patch.tag = nextTag;
    const minutes = readMinutes(time);
    // An estimate we can't read keeps the editor open instead of dropping it.
    if (minutes === undefined) return setBadTime(true);
    if (minutes !== (task.estimate || null)) patch.estimate = minutes;
    if (Object.keys(patch).length) onPatch(patch);
    onClose();
  };
  const keys = (e: KeyboardEvent) => {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') onClose();
  };
  const label = (m: Move) => (m === 'today' ? t.moveToday : m === 'tomorrow' ? t.moveTomorrow : t.moveBacklog);

  return (
    <div className="editor" role="group" aria-label={task.title}>
      <div className="head">
        <input className="title-input" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={keys} aria-label={t.titleField} />
        <button type="button" className="icon-btn" onClick={onClose} aria-label={t.close} title={t.close}>
          <X />
        </button>
      </div>
      {subtaskOps && <Subtasks task={task} ops={subtaskOps} onEscape={onClose} />}
      <div className="fields">
        <label className="field">
          <span>{t.tagField}</span>
          <input className="box" value={tag} placeholder={t.tagPlaceholder} onChange={(e) => setTag(e.target.value)} onKeyDown={keys} />
          {recent.length > 0 && (
            <span className="recent">
              {t.usedBefore}
              {recent.map((x) => (
                <button key={x} type="button" onClick={() => setTag(x)}>
                  {x}
                </button>
              ))}
            </span>
          )}
        </label>
        <label className="field time">
          <span>{t.timeField}</span>
          <input
            className="box"
            value={time}
            placeholder="45m, 1h30"
            aria-invalid={badTime || undefined}
            onChange={(e) => {
              setTime(e.target.value);
              setBadTime(false);
            }}
            // Clicking in picks the whole estimate, so typing replaces it.
            onFocus={(e) => e.currentTarget.select()}
            onMouseUp={(e) => e.preventDefault()}
            onKeyDown={keys}
          />
        </label>
      </div>
      {asking ? (
        <div className="bar">
          <span className="meta">
            <strong>{t.deleteQ}</strong>
          </span>
          <span className="moves">
            <button type="button" className="btn quiet" onClick={() => setAsking(false)}>
              {t.keepIt}
            </button>
            <button type="button" className="btn danger" onClick={onDelete}>
              {t.deleteBtn}
            </button>
          </span>
        </div>
      ) : (
        <div className="bar">
          <span className="moves">
            {moves.map((m) => (
              <button
                key={m}
                type="button"
                className="btn"
                onClick={() => {
                  onPatch({ date: m === 'backlog' ? null : m });
                  onClose();
                }}
              >
                {label(m)}
              </button>
            ))}
          </span>
          <span className="moves">
            <button type="button" className="btn quiet" onClick={() => setAsking(true)}>
              {t.deleteBtn}
            </button>
            <button type="button" className="btn solid" onClick={save}>
              {t.save}
            </button>
          </span>
        </div>
      )}
    </div>
  );
}

// A task's subtasks, inside the open task. Each change saves at once (so
// Escape never loses one); the list shows it before the save comes back.
function Subtasks({ task, ops, onEscape }: { task: Task; ops: SubtaskOps; onEscape: () => void }) {
  const { t } = useSession();
  // Shown now, saved in a moment: the list follows the task again whenever a save comes back.
  const [shown, setShown] = useState({ from: task.subtasks, list: task.subtasks });
  let list = shown.list;
  if (shown.from !== task.subtasks) {
    list = task.subtasks;
    setShown({ from: task.subtasks, list });
  }
  const set = (next: Subtask[]) => setShown({ from: task.subtasks, list: next });
  const [writing, setWriting] = useState(list.length > 0);
  const [draft, setDraft] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const drafts = useRef(0);
  const saved = (s: Subtask) => !s.id.startsWith('new:');
  const done = list.filter((s) => s.done).length;

  const add = () => {
    const title = draft.trim();
    if (!title) return;
    setDraft('');
    set([...list, { id: `new:${(drafts.current += 1)}`, title, done: false }]);
    ops.addSubtask(task.id, title);
  };
  const remove = (s: Subtask) => {
    set(list.filter((x) => x !== s));
    ops.removeSubtask(task.id, s.id);
  };
  const keys = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      add();
    } else if (e.key === 'Escape') {
      onEscape();
    } else if (e.key === 'Backspace' && !draft && list.length && saved(list[list.length - 1])) {
      e.preventDefault();
      remove(list[list.length - 1]);
    }
  };

  // A subtask an agent adds while this task is open shows the list, not the start link.
  if (!writing && !list.length) {
    return (
      <button
        type="button"
        className="subtask-start"
        onClick={() => {
          setWriting(true);
          requestAnimationFrame(() => input.current?.focus());
        }}
      >
        <PlusIcon />
        {t.addSubtask}
      </button>
    );
  }
  return (
    <div className="subtasks" role="group" aria-label={t.subtasks}>
      {list.length > 0 && (
        <div className="subtasks-head">
          <span>{t.subtasks}</span>
          <span className="count">{fill(t.subtasksDoneShort, { done, n: list.length })}</span>
        </div>
      )}
      {list.map((s) => (
        <div key={s.id} className={`subtask${s.done ? ' is-done' : ''}${saved(s) ? '' : ' pending'}`}>
          <Check
            on={s.done}
            label={s.title}
            onClick={() => {
              if (!saved(s)) return;
              set(list.map((x) => (x === s ? { ...x, done: !x.done } : x)));
              ops.patchSubtask(task.id, s.id, { done: !s.done });
            }}
          />
          <SubtaskTitle subtask={s} disabled={!saved(s)} onRename={(title) => ops.patchSubtask(task.id, s.id, { title })} label={t.subtaskField} />
          <button type="button" className="icon-btn remove" disabled={!saved(s)} onClick={() => remove(s)} aria-label={`${t.removeSubtask}: ${s.title}`} title={t.removeSubtask}>
            <X />
          </button>
        </div>
      ))}
      <div className="subtask adding">
        <span className="check ghost" aria-hidden />
        <input
          ref={input}
          className="subtask-input"
          value={draft}
          placeholder={t.addSubtask}
          aria-label={t.addSubtask}
          enterKeyHint="enter"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={keys}
          // Leaving the line (Save, another field, the close button) keeps what was typed.
          onBlur={add}
        />
        <kbd className="enter-hint" aria-hidden>
          {t.enterKey}
        </kbd>
        <button type="button" className="add-btn" onClick={add} disabled={!draft.trim()}>
          {t.add}
        </button>
      </div>
    </div>
  );
}

// A subtask's title, renamed in place: Enter or leaving the line saves it; Escape puts it back.
function SubtaskTitle({ subtask, disabled, onRename, label }: { subtask: Subtask; disabled: boolean; onRename: (title: string) => void; label: string }) {
  const [value, setValue] = useState(subtask.title);
  const [from, setFrom] = useState(subtask.title);
  const cancelled = useRef(false);
  if (from !== subtask.title) {
    setFrom(subtask.title);
    setValue(subtask.title);
  }
  const commit = () => {
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    const title = value.trim();
    if (!title) return setValue(subtask.title);
    if (title !== subtask.title) onRename(title);
  };
  return (
    <input
      className="subtask-title"
      value={value}
      disabled={disabled}
      aria-label={label}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          cancelled.current = true;
          setValue(subtask.title);
          e.currentTarget.blur();
        }
      }}
    />
  );
}

export function AddRow({ placeholder, onAdd }: { placeholder: string; onAdd: (text: string) => Promise<unknown> | void }) {
  const [text, setText] = useState('');
  return (
    <form
      className="add-row"
      onSubmit={async (e) => {
        e.preventDefault();
        const value = text.trim();
        if (!value) return;
        setText('');
        await onAdd(value);
      }}
    >
      <span className="plus-icon">
        <PlusIcon />
      </span>
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
    </form>
  );
}
