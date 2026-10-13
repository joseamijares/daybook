'use client';

import { useState } from 'react';
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
  onPatch: (patch: Partial<Pick<Task, 'title' | 'date'>> & { date?: string | null }) => void;
  onDelete: () => void;
  moves?: ('today' | 'tomorrow' | 'backlog')[];
  draggable?: boolean;
  dropBefore?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDragOver?: () => void;
}

export function TaskRow({ task, onToggle, onPatch, onDelete, moves = ['tomorrow', 'backlog'], ...drag }: Props) {
  const { t, session } = useSession();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [dragging, setDragging] = useState(false);

  const tag = task.source ? (
    <a className="tag linear" href={task.source.url} target="_blank" rel="noreferrer" title={task.source.state}>
      {task.source.key}
    </a>
  ) : task.rolledFrom && !task.done && task.rolledFrom !== task.date ? (
    <span className="tag rolled" title={task.rolledFrom}>
      {session.locale === 'es' ? 'desde' : 'from'} {dow(task.rolledFrom, session.locale)}
    </span>
  ) : (
    <span className="tag">{task.tag || ''}</span>
  );

  const save = () => {
    setEditing(false);
    if (title.trim() && title.trim() !== task.title) onPatch({ title: title.trim() });
    else setTitle(task.title);
  };

  return (
    <div
      className={`row${dragging ? ' dragging' : ''}${drag.dropBefore ? ' drop-before' : ''}`}
      draggable={drag.draggable && !editing}
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
      {editing ? (
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
              setEditing(false);
            }
          }}
        />
      ) : (
        <button type="button" className={`title${task.done ? ' is-done' : ''}`} onDoubleClick={() => setEditing(true)} title={task.notes || undefined}>
          {task.title}
        </button>
      )}
      {tag}
      <span className="est">{task.estimate ? minutesLabel(task.estimate) : ''}</span>
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
          <button type="button" className="keep-mobile" aria-label={t.remove} onClick={() => confirm(t.deleteConfirm) && onDelete()}>
            ×
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
