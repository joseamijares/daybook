'use client';

import { useEffect, useState } from 'react';
import type { Task } from '@/lib/daybook';
import { dow } from '@/lib/i18n';
import { minutesLabel } from '@/lib/time';
import { useSession } from './client';

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

interface Props {
  task: Task;
  onToggle: () => void;
  onPatch: (patch: { title?: string; date?: string | null; tag?: string | null; estimate?: number | null }) => void;
  onDelete: () => void;
  moves?: ('today' | 'tomorrow' | 'backlog')[];
  draggable?: boolean;
  dropBefore?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDragOver?: () => void;
}

// "45m", "1h30", "1.5h", "90" → minutes; "" → no estimate.
function readMinutes(s: string): number | null | undefined {
  const v = s.trim().toLowerCase().replace(',', '.');
  if (!v) return null;
  const h = v.match(/^(\d+(?:\.\d+)?)\s*h(?:\s*(\d{1,2})\s*m?)?$/);
  if (h) return Math.round(parseFloat(h[1]) * 60) + (h[2] ? Number(h[2]) : 0);
  const m = v.match(/^(\d{1,4})\s*m?(?:in)?$/);
  return m ? Number(m[1]) : undefined;
}

export function TaskRow({ task, onToggle, onPatch, onDelete, moves = ['tomorrow', 'backlog'], ...drag }: Props) {
  const { t, session } = useSession();
  const [editing, setEditing] = useState<null | 'title' | 'tag' | 'estimate'>(null);
  const [title, setTitle] = useState(task.title);
  const [draft, setDraft] = useState('');
  const [dragging, setDragging] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // A first click on × asks; the question goes away by itself.
  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), 3000);
    return () => clearTimeout(timer);
  }, [confirming]);

  const rolled = task.rolledFrom && !task.done && task.rolledFrom !== task.date;

  const edit = (what: 'tag' | 'estimate') => {
    setDraft(what === 'tag' ? task.tag || '' : task.estimate ? minutesLabel(task.estimate).replace(' ', '') : '');
    setEditing(what);
  };

  const commitSmall = () => {
    if (editing === 'tag') {
      const tag = draft.trim().replace(/^#/, '').replace(/\s+/g, '-').slice(0, 40) || null;
      if (tag !== (task.tag || null)) onPatch({ tag });
    }
    if (editing === 'estimate') {
      const minutes = readMinutes(draft);
      if (minutes !== undefined && minutes !== (task.estimate || null)) onPatch({ estimate: minutes });
    }
    setEditing(null);
  };

  const small = (cls: string, placeholder: string) => (
    <input
      className={cls}
      autoFocus
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={commitSmall}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commitSmall();
        if (e.key === 'Escape') setEditing(null);
      }}
      aria-label={placeholder}
    />
  );

  const tag = task.source ? (
    <a className="tag linear" href={task.source.url} target="_blank" rel="noreferrer" title={task.source.state}>
      {task.source.key}
    </a>
  ) : editing === 'tag' ? (
    small('tag-input', t.tagPlaceholder)
  ) : (
    <button type="button" className={`tag tag-btn${task.tag ? '' : ' empty'}`} onClick={() => edit('tag')} title={t.editTag}>
      {task.tag || t.addTag}
    </button>
  );

  const save = () => {
    setEditing(null);
    if (title.trim() && title.trim() !== task.title) onPatch({ title: title.trim() });
    else setTitle(task.title);
  };

  return (
    <div
      className={`row${dragging ? ' dragging' : ''}${drag.dropBefore ? ' drop-before' : ''}`}
      draggable={drag.draggable && !editing}
      data-confirming={confirming || undefined}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.effectAllowed = 'move';
        setDragging(true);
        drag.onDragStart?.();
      }}
      onDragEnd={() => {
        setDragging(false);
        drag.onDragEnd?.();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        drag.onDragOver?.();
      }}
    >
      <Check on={task.done} onClick={onToggle} label={task.title} />
      {editing === 'title' ? (
        <input
          className="title"
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') {
              setTitle(task.title);
              setEditing(null);
            }
          }}
        />
      ) : (
        <button type="button" className={`title${task.done ? ' is-done' : ''}`} onDoubleClick={() => setEditing('title')} title={task.notes || t.editTitle}>
          <span className="strike">{task.title}</span>
          {rolled && (
            <span className="rolled-note" title={task.rolledFrom!}>
              {' '}
              · {session.locale === 'es' ? 'desde' : 'from'} {dow(task.rolledFrom!, session.locale)}
            </span>
          )}
        </button>
      )}
      {tag}
      {editing === 'estimate' ? (
        small('est-input', '45m')
      ) : (
        <button type="button" className={`est est-btn${task.estimate ? '' : ' empty'}`} onClick={() => edit('estimate')} title={t.editEstimate}>
          {task.estimate ? minutesLabel(task.estimate) : '–'}
        </button>
      )}
      {!editing && (
        <span className="actions">
          {moves.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onPatch({ date: m === 'backlog' ? null : m })}
            >
              {m === 'today' ? t.moveToday : m === 'tomorrow' ? t.moveTomorrow : t.moveBacklog}
            </button>
          ))}
          <button
            type="button"
            className={`keep-mobile delete${confirming ? ' asking' : ''}`}
            aria-label={confirming ? t.deleteAsk : t.remove}
            onClick={() => (confirming ? onDelete() : setConfirming(true))}
          >
            {confirming ? t.deleteAsk : '×'}
          </button>
        </span>
      )}
    </div>
  );
}

export function AddRow({ placeholder, onAdd }: { placeholder: string; onAdd: (text: string) => Promise<unknown> | void }) {
  const [text, setText] = useState('');
  return (
    <form
      className="row add"
      onSubmit={async (e) => {
        e.preventDefault();
        const value = text.trim();
        if (!value) return;
        setText('');
        await onAdd(value);
      }}
    >
      <span className="plus" aria-hidden>
        +
      </span>
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
    </form>
  );
}
