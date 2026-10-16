import { describe, expect, it } from 'vitest';
import { arranged } from '../components/sortable';
import type { DayView, Task, WeekView } from '../lib/daybook';
import { placeAt } from '../lib/order';

describe('placeAt', () => {
  const ids = ['a', 'b', 'c', 'd'];
  it('moves a task up', () => expect(placeAt(ids, 'c', 0)).toEqual(['c', 'a', 'b', 'd']));
  it('moves a task down onto the line before another', () => expect(placeAt(ids, 'a', 2)).toEqual(['b', 'a', 'c', 'd']));
  it('leaves a task in place when dropped just below itself', () => expect(placeAt(ids, 'b', 2)).toEqual(ids));
  it('moves a task to the end', () => expect(placeAt(ids, 'a', 4)).toEqual(['b', 'c', 'd', 'a']));
  it('inserts a new task at the line', () => expect(placeAt(ids, 'x', 1)).toEqual(['a', 'x', 'b', 'c', 'd']));
});

describe('arranged', () => {
  const task = (id: string, date: string | null): Task => ({
    id,
    title: id,
    notes: null,
    date,
    estimate: null,
    tag: null,
    done: false,
    doneAt: null,
    order: 0,
    source: null,
    rolledFrom: null,
    createdAt: '',
    updatedAt: '',
  });
  const day = (date: string, tasks: Task[]): DayView => ({ date, focus: null, note: null, shutdownAt: null, isToday: false, tasks, planned: 0, remaining: 0, doneCount: 0, capacity: 480, over: 0, previous: null });
  const week = {
    weekOf: '2026-10-12',
    focus: null,
    today: '2026-10-15',
    days: [day('2026-10-15', [task('a', '2026-10-15'), task('b', '2026-10-15')]), day('2026-10-16', [task('c', '2026-10-16')])],
    backlog: [task('x', null), task('y', null)],
  } satisfies WeekView;
  const ids = (w: WeekView) => [...w.days.map((d) => d.tasks.map((x) => `${x.id}@${x.date}`)), w.backlog.map((x) => `${x.id}@${x.date}`)];

  it('moves a task onto another day, on a line', () =>
    expect(ids(arranged(week, '2026-10-16', ['a', 'c']))).toEqual([['b@2026-10-15'], ['a@2026-10-16', 'c@2026-10-16'], ['x@null', 'y@null']]));
  it('takes a task from the backlog', () =>
    expect(ids(arranged(week, '2026-10-15', ['a', 'y', 'b']))).toEqual([['a@2026-10-15', 'y@2026-10-15', 'b@2026-10-15'], ['c@2026-10-16'], ['x@null']]));
  it('puts a day’s task back first in the backlog', () =>
    expect(ids(arranged(week, null, ['c', 'x', 'y']))).toEqual([['a@2026-10-15', 'b@2026-10-15'], [], ['c@null', 'x@null', 'y@null']]));
});
