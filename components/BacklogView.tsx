'use client';

import type { Task } from '@/lib/daybook';
import { fill } from '@/lib/i18n';
import { Masthead } from './Masthead';
import { useResource, useSession } from './client';
import { useOps } from './ops';
import { AddRow, TaskRow } from './TaskRow';

export function BacklogView() {
  const { session, t } = useSession();
  const { data, reload } = useResource<{ backlog: Task[] }>('/api/tasks');
  const ops = useOps(reload);
  const list = data?.backlog || [];
  const linear = list.filter((x) => x.source);
  const own = list.filter((x) => !x.source);
  const tags = list.map((x) => x.tag).filter((x): x is string => Boolean(x));

  const group = (title: string, tasks: Task[]) =>
    tasks.length > 0 && (
      <div>
        <div className="section-head">
          <span className="label">{title}</span>
          <span className="meta">{tasks.length}</span>
        </div>
        <div className="rows">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onToggle={() => ops.toggle(task)}
              onPatch={(p) => ops.patch(task.id, p)}
              onDelete={() => ops.remove(task.id)}
              moves={['today', 'tomorrow']}
              tags={tags}
            />
          ))}
        </div>
      </div>
    );

  return (
    <section className="placard" aria-label={t.backlog}>
      <Masthead
        title={t.backlog}
        sub={session.linear ? fill(t.backlogSub, { n: list.length, linear: linear.length }) : (list.length === 1 ? t.oneTask : fill(t.tasksN, { n: list.length }))}
        actions={
          session.linear && (
            <button type="button" className="pill" onClick={() => ops.syncLinear()}>
              {t.syncLinear}
            </button>
          )
        }
      />
      <div className="rows">
        <AddRow placeholder={`${t.addTask}  ·  ${t.addHint}`} onAdd={(text) => ops.add({ text, date: null })} />
      </div>
      {!data ? <p className="meta">{t.loading}</p> : !list.length && <p className="empty">{t.emptyBacklog}</p>}
      {group(t.fromLinear, linear)}
      {group(t.backlog, own)}
    </section>
  );
}
