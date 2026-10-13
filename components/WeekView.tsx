'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { DayView, WeekView as Week } from '@/lib/daybook';
import { dayNum, dow, fill, fmtDate, monthDay, weekdayName } from '@/lib/i18n';
import { addDays, minutesLabel, mondayOf } from '@/lib/time';
import { useLook, useResource, useSession } from './client';
import { capitalize } from './day';
import { DraftText } from './DraftText';
import { Masthead } from './Masthead';
import { useOps } from './ops';
import { Check } from './TaskRow';

const Chevron = ({ back }: { back?: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
    <path d={back ? 'M8.5 3 4.5 7l4 4' : 'M5.5 3 9.5 7l-4 4'} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function WeekView() {
  const { session, t } = useSession();
  const { style } = useLook();
  const [anchor, setAnchor] = useState(mondayOf(session.today));
  const { data: week, reload } = useResource<Week>(`/api/week?date=${anchor}`);
  const ops = useOps(reload);
  const [over, setOver] = useState<string | null>(null);

  if (!week) {
    return (
      <section className="placard wide">
        <p className="meta">{t.loading}</p>
      </section>
    );
  }

  const current = week.weekOf === mondayOf(session.today);
  // Weekdays always; a weekend day only when something is planned on it.
  const columns = week.days.filter((d, i) => i < 5 || d.tasks.length || d.focus);
  const planned = week.days.reduce((s, d) => s + d.planned, 0);
  const range = `${capitalize(monthDay(week.weekOf, session.locale))} – ${dayNum(addDays(week.weekOf, 6))}`;
  const plannedLabel = fill(t.plannedTotal, { h: minutesLabel(planned) });

  // Only tasks we know about move (not text dragged in from a field), and only
  // onto today or later: a past day would roll them straight back to today.
  const known = new Set([...week.days.flatMap((d) => d.tasks), ...week.backlog].map((x) => x.id));
  const drop = (date: string, e: React.DragEvent) => {
    e.preventDefault();
    setOver(null);
    const id = e.dataTransfer.getData('text/plain');
    if (known.has(id) && date >= session.today) ops.patch(id, { date });
  };

  const title = style === 'notebook' ? fill(t.weekOf, { date: monthDay(week.weekOf, session.locale) }) : current ? t.thisWeek : range;
  const sub =
    style === 'notebook'
      ? plannedLabel
      : style === 'timetable'
        ? `${capitalize(fmtDate(week.weekOf, session.locale, { month: 'long' }))} · ${plannedLabel}`
        : `${range} · ${plannedLabel}`;

  return (
    <section className="placard wide" aria-label={t.week}>
      <Masthead
        numeral={`${dayNum(week.weekOf)}–${dayNum(addDays(week.weekOf, 6))}`}
        title={capitalize(title)}
        sub={sub}
        actions={
          <>
            <button type="button" className="pill round" onClick={() => setAnchor(addDays(week.weekOf, -7))} aria-label={t.prevWeek}>
              <Chevron back />
            </button>
            {!current && (
              <button type="button" className="pill" onClick={() => setAnchor(mondayOf(session.today))}>
                {t.today}
              </button>
            )}
            <button type="button" className="pill round" onClick={() => setAnchor(addDays(week.weekOf, 7))} aria-label={t.nextWeek}>
              <Chevron />
            </button>
            {session.frame && (
              <button type="button" className="pill solid" onClick={() => ops.sendToFrame(week.weekOf)}>
                {t.sendToFrame}
              </button>
            )}
          </>
        }
      />

      <div className="focus-block labelled">
        <span className="prompt">{style === 'notebook' ? t.weekIsFor : style === 'timetable' ? t.focusLabel : t.weekFocusPlaceholder}</span>
        <DraftText
          key={`${week.weekOf}:${week.focus || ''}`}
          value={week.focus || ''}
          placeholder={t.weekFocusPlaceholder}
          label={t.weekFocusPlaceholder}
          onCommit={(next) => ops.setWeekFocus(week.weekOf, next)}
        />
      </div>

      <div className="cols">
        {columns.map((d) => (
          <Column
            key={d.date}
            day={d}
            past={d.date < session.today}
            highlighted={over === d.date}
            onDragOver={() => setOver(d.date)}
            onDragLeave={() => setOver((o) => (o === d.date ? null : o))}
            onDrop={(e) => drop(d.date, e)}
            ops={ops}
          />
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 16, borderTop: '1px solid var(--color-card-ink)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
          <span style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
            <span className="label">{style === 'notebook' ? t.someday : t.backlog}</span>
            <span className="meta">{t.dragHint}</span>
          </span>
          <span className="meta" style={{ display: 'flex', gap: 16 }}>
            {session.linear && (
              <button type="button" className="link-btn" onClick={() => ops.syncLinear()}>
                {t.syncLinear}
              </button>
            )}
            <Link className="link-btn" href="/backlog">
              {t.seeAll} · {week.backlog.length}
            </Link>
          </span>
        </div>
        <div className="chips">
          {!week.backlog.length && <span className="meta">{t.emptyBacklog}</span>}
          {week.backlog.slice(0, 10).map((task) => (
            <div key={task.id} className="chip" draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', task.id)}>
              {task.source && <span className="key">{task.source.key}</span>}
              <span>{task.title}</span>
              {task.estimate ? <span className="est">{minutesLabel(task.estimate)}</span> : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Column({
  day,
  past,
  highlighted,
  onDragOver,
  onDragLeave,
  onDrop,
  ops,
}: {
  day: DayView;
  past: boolean;
  highlighted: boolean;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  ops: ReturnType<typeof useOps>;
}) {
  const { session, t } = useSession();
  const { style } = useLook();
  const [text, setText] = useState('');
  const fill100 = Math.min(100, (day.planned / day.capacity) * 100);
  const ends = day.tasks.map((_, i) => day.tasks.slice(0, i + 1).reduce((s, x) => s + (x.estimate || 0), 0));

  return (
    <div
      className={['col', day.isToday && 'is-today', past && 'is-past', highlighted && 'drop'].filter(Boolean).join(' ')}
      onDragOver={(e) => {
        if (past) return; // not a drop target
        e.preventDefault();
        onDragOver();
      }}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && onDragLeave()}
      onDrop={onDrop}
    >
      <Link className="col-head" href={`/?date=${day.date}`}>
        <span>
          <span className="dow">{capitalize(style === 'notebook' ? weekdayName(day.date, session.locale) : dow(day.date, session.locale))}</span>
          <span className="num">{dayNum(day.date)}</span>
        </span>
        <span className="hrs" style={day.over ? { color: 'var(--color-amber)', fontWeight: 600 } : undefined}>
          {day.planned ? minutesLabel(day.planned) : ''}
        </span>
      </Link>
      {style === 'wall' && (
        <div className="load">
          <div className={day.over ? 'over' : 'done'} style={{ width: `${fill100}%`, opacity: past ? 0.5 : 1 }} />
        </div>
      )}
      <DraftText
        key={day.focus || ''}
        className="focus sm"
        value={day.focus || ''}
        placeholder={t.dayFocusPlaceholder}
        label={`${t.dayFocusPlaceholder} ${day.date}`}
        onCommit={(next) => ops.setFocus(day.date, next)}
      />
      <div>
        {day.tasks.map((task, i) => {
          const height = Math.max(26, Math.round(((task.estimate || 30) / 60) * 28));
          return (
            <div
              key={task.id}
              className={['item', task.done && 'done', !task.done && ends[i] > day.capacity && 'past-cap'].filter(Boolean).join(' ')}
              style={{ '--h': height } as React.CSSProperties}
              draggable
              onDragStart={(e) => e.dataTransfer.setData('text/plain', task.id)}
            >
              <span style={{ transform: 'scale(0.8)', transformOrigin: 'left top' }}>
                <Check on={task.done} onClick={() => ops.toggle(task)} label={task.title} />
              </span>
              <span className={`title${task.done ? ' is-done' : ''}`} title={task.source?.key || task.tag || undefined}>
                <span className={`strike${task.done ? ' is-done' : ''}`}>{task.title}</span>
              </span>
              <span className="est">{task.estimate ? minutesLabel(task.estimate) : ''}</span>
            </div>
          );
        })}
        {highlighted && <div className="drop-note">{fill(t.dropOn, { day: weekdayName(day.date, session.locale) })}</div>}
        {!past && <form
          className="add"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) ops.add({ text: text.trim(), date: day.date });
            setText('');
          }}
        >
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`+ ${t.add}`} aria-label={`${t.addTask} ${day.date}`} />
        </form>}
      </div>
      {day.over > 0 && (
        <span className="warn">
          {minutesLabel(day.over)} {t.hourOver}
        </span>
      )}
    </div>
  );
}
