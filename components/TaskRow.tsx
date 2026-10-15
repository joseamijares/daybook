'use client';

import { type KeyboardEvent, useState } from 'react';
import type { Task } from '@/lib/daybook';
import { dow, fill, weekdayName } from '@/lib/i18n';
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

export function TaskRow({ task, onToggle, onPatch, onDelete, moves = ['tomorrow', 'backlog'], tags = [], sort }: Props) {
  const [open, setOpen] = useState(false);
  const { carried, linearState } = useTaskNotes(task);

  const meta: React.ReactNode[] = [];
  if (task.tag) meta.push(<span key="tag" className="tag">{task.tag}</span>);
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
      <div className={['row', 'hoverable', task.done && 'is-done'].filter(Boolean).join(' ')} {...sort}>
        <Check on={task.done} onClick={onToggle} label={task.title} />
        <div className="body" role="button" tabIndex={0} aria-expanded={open} onClick={toggleOpen} onKeyDown={onKey}>
          <span className="line">
            <span className={`name strike${task.done ? ' is-done' : ''}`}>{task.title}</span>
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
      {open && <Editor task={task} tags={tags} moves={moves} onPatch={onPatch} onDelete={onDelete} onClose={() => setOpen(false)} />}
    </>
  );
}

// An open task, in place: rename it, tag it, time it, move it or delete it.
// Enter saves, Escape closes without saving.
export function Editor({
  task,
  tags,
  moves,
  onPatch,
  onDelete,
  onClose,
}: {
  task: Task;
  tags: string[];
  moves: Move[];
  onPatch: (patch: Patch) => void;
  onDelete: () => void;
  onClose: () => void;
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
      <input className="title-input" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={keys} aria-label={t.titleField} />
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
