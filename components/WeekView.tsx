'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { DayView, WeekView as Week } from '@/lib/daybook';
import { dayNum, dow, fmtDate } from '@/lib/i18n';
import { addDays, minutesLabel, mondayOf } from '@/lib/time';
import { useResource, useSession } from './client';
import { DraftText } from './DraftText';
import { FrameDesign } from './FrameDesign';
import { useOps } from './ops';
import { Check } from './TaskRow';

function isoWeek(ymd: string) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - start) / 86400000 + 1) / 7);
}

export function WeekView() {
  const { session, t } = useSession();
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
  const range = `${fmtDate(week.weekOf, session.locale, { month: 'long', day: 'numeric' })} – ${fmtDate(columns[columns.length - 1].date, session.locale, { day: 'numeric' })}`;

  const drop = (date: string, e: React.DragEvent) => {
    e.preventDefault();
    setOver(null);
    const id = e.dataTransfer.getData('text/plain');
    if (id) ops.patch(id, { date });
  };

  return (
    <section className="placard wide" aria-label={t.week}>
      <div>
        <p className="eyebrow">
          {range} · {session.locale === 'es' ? 'semana' : 'week'} {isoWeek(week.weekOf)}
        </p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
          <h1 className="big">{current ? t.thisWeek : fmtDate(week.weekOf, session.locale, { month: 'short', day: 'numeric' })}</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="pill" onClick={() => setAnchor(addDays(week.weekOf, -7))} aria-label={t.prevWeek}>
              ‹
            </button>
            {!current && (
              <button type="button" className="pill" onClick={() => setAnchor(mondayOf(session.today))}>
                {t.today}
              </button>
            )}
            <button type="button" className="pill" onClick={() => setAnchor(addDays(week.weekOf, 7))} aria-label={t.nextWeek}>
              ›
            </button>
            {session.frame && (
              <button type="button" className="pill solid" onClick={() => ops.sendToFrame(week.weekOf)}>
                {t.sendToFrame}
              </button>
            )}
          </div>
        </div>
      </div>

      <DraftText
        key={`${week.weekOf}:${week.focus || ''}`}
        value={week.focus || ''}
        placeholder={t.weekFocusPlaceholder}
        label={t.weekFocusPlaceholder}
        onCommit={(next) => ops.setWeekFocus(week.weekOf, next)}
      />

      <div className="cols">
        {columns.map((d) => (
          <Column
            key={d.date}
            day={d}
            highlighted={over === d.date}
            onDragOver={() => setOver(d.date)}
            onDrop={(e) => drop(d.date, e)}
            ops={ops}
          />
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
        <div className="section-head" style={{ borderBottom: 0, borderTop: '1px solid var(--color-card-ink)', paddingTop: 14 }}>
          <span className="label">
            {t.backlog} · {t.dragHint}
          </span>
          <span className="meta" style={{ display: 'flex', gap: 14 }}>
            {session.linear && (
              <button type="button" className="link-btn" onClick={() => ops.syncLinear()}>
                {t.syncLinear}
              </button>
            )}
            <Link className="link-btn" href="/backlog">
              {week.backlog.length} · {t.seeAll}
            </Link>
          </span>
        </div>
        <div className="chips">
          {!week.backlog.length && <span className="meta">{t.emptyBacklog}</span>}
          {week.backlog.slice(0, 8).map((task) => (
            <div key={task.id} className="chip" draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', task.id)}>
              {task.source && <span className="key">{task.source.key}</span>}
              <span>{task.title}</span>
              {task.estimate ? <span className="meta" style={{ fontSize: 12 }}>{minutesLabel(task.estimate)}</span> : null}
            </div>
          ))}
        </div>
      </div>
      {session.frame && <FrameDesign />}
    </section>
  );
}

function Column({
  day,
  highlighted,
  onDragOver,
  onDrop,
  ops,
}: {
  day: DayView;
  highlighted: boolean;
  onDragOver: () => void;
  onDrop: (e: React.DragEvent) => void;
  ops: ReturnType<typeof useOps>;
}) {
  const { session, t } = useSession();
  const [text, setText] = useState('');
  const fill = Math.min(100, (day.planned / day.capacity) * 100);

  return (
    <div
      className={`col${day.isToday ? ' is-today' : ''}${highlighted ? ' drop' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver();
      }}
      onDrop={onDrop}
    >
      <Link className="col-head" href={`/?date=${day.date}`}>
        <span>
          <span className="dow">{dow(day.date, session.locale)}</span>
          <span className="num">{dayNum(day.date)}</span>
        </span>
        <span className="hrs" style={day.over ? { color: 'var(--color-amber)' } : undefined}>
          {day.planned ? minutesLabel(day.planned) : ''}
        </span>
      </Link>
      <div className={`load${day.over ? ' over' : ''}`}>
        <div className="done" style={{ width: `${fill}%`, background: day.isToday || day.over ? undefined : 'var(--color-card-ink-2)' }} />
      </div>
      <DraftText
        key={day.focus || ''}
        className="focus sm"
        value={day.focus || ''}
        placeholder={t.dayFocusPlaceholder}
        label={`${t.dayFocusPlaceholder} ${day.date}`}
        onCommit={(next) => ops.setFocus(day.date, next)}
      />
      <div>
        {day.tasks.map((task) => (
          <div key={task.id} className="item" draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', task.id)}>
            <span style={{ transform: 'scale(0.78)', marginTop: 0 }}>
              <Check on={task.done} onClick={() => ops.toggle(task)} label={task.title} />
            </span>
            <span className={`title${task.done ? ' is-done' : ''}`} title={task.source?.key || task.tag || undefined}>
              <span className="strike">{task.title}</span>
            </span>
            <span className="est">{task.estimate ? minutesLabel(task.estimate) : ''}</span>
          </div>
        ))}
        <form
          className="add"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) ops.add({ text: text.trim(), date: day.date });
            setText('');
          }}
        >
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`+ ${t.add}`} aria-label={`${t.addTask} ${day.date}`} />
        </form>
      </div>
      {day.over > 0 && (
        <span className="warn">
          {minutesLabel(day.over)} {t.hourOver}
        </span>
      )}
    </div>
  );
}
