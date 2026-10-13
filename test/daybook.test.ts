import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addTask, backlog, getDay, getWeek, parseQuickAdd, planDay, rollover, setDay, shutdown, updateTask } from '@/lib/daybook';
import { toFramePlan } from '@/lib/frame';
import { fileStore, setStore } from '@/lib/store';
import { mondayOf, resolveDate } from '@/lib/time';

beforeEach(() => {
  setStore(fileStore(path.join(mkdtempSync(path.join(tmpdir(), 'daybook-')), 'db.json')));
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-12T15:00:00Z')); // Monday
  process.env.DAYBOOK_TZ = 'UTC';
});
afterEach(() => {
  vi.useRealTimers();
  setStore(null);
});

describe('quick add', () => {
  it.each([
    ['Draft deck 45m #client', { title: 'Draft deck', estimate: 45, tag: 'client' }],
    ['Write spec 1h30', { title: 'Write spec', estimate: 90, tag: null }],
    ['Write spec 1.5h', { title: 'Write spec', estimate: 90, tag: null }],
    ['Call mom', { title: 'Call mom', estimate: null, tag: null }],
    ['Revisar #cliente 2h propuesta', { title: 'Revisar propuesta', estimate: 120, tag: 'cliente' }],
  ])('%s', (text, expected) => expect(parseQuickAdd(text)).toEqual(expected));
});

describe('dates', () => {
  it('reads words, weekdays and backlog', () => {
    expect(resolveDate('tomorrow', '2026-10-12')).toBe('2026-10-13');
    expect(resolveDate('friday', '2026-10-12')).toBe('2026-10-16');
    expect(resolveDate('monday', '2026-10-12')).toBe('2026-10-19');
    expect(resolveDate('backlog')).toBeNull();
    expect(mondayOf('2026-10-18')).toBe('2026-10-12');
    expect(() => resolveDate('someday')).toThrow();
  });
});

describe('days', () => {
  it('sums the workload and flags overcommitment', async () => {
    await addTask({ text: 'Big thing 5h' });
    await addTask({ text: 'Another 2h' });
    const day = await getDay();
    expect(day.planned).toBe(420);
    expect(day.over).toBe(60);
  });

  it('rolls unfinished work into today, remembering where it started', async () => {
    const t = await addTask({ title: 'Old', date: '2026-10-09' });
    await addTask({ title: 'Done old', date: '2026-10-09' }).then((d) => updateTask(d.id, { done: true }));
    expect(await rollover()).toBe(1);
    const day = await getDay();
    expect(day.tasks.map((x) => x.title)).toEqual(['Old']);
    expect(day.tasks[0].rolledFrom).toBe('2026-10-09');
    expect(day.tasks[0].id).toBe(t.id);
  });

  it('plans a day in order from the backlog', async () => {
    const a = await addTask({ title: 'A', date: 'backlog' });
    const b = await addTask({ title: 'B', date: 'backlog' });
    const { day } = await planDay('today', [b.id, a.id], 'Ship it');
    expect(day.tasks.map((x) => x.title)).toEqual(['B', 'A']);
    expect(day.focus).toBe('Ship it');
    expect(await backlog()).toEqual([]);
  });

  it('shuts down: carries unfinished work and writes a recap', async () => {
    const a = await addTask({ text: 'Finish 1h' });
    const b = await addTask({ title: 'Later' });
    const c = await addTask({ title: 'Someday' });
    await updateTask(a.id, { done: true });
    const r = await shutdown('today', { note: 'Good day', carry: { [c.id]: 'backlog' } });
    expect(r.summary).toBe('1 of 3 done, about 1h of work. 2 move on.');
    expect((await getDay('2026-10-13')).tasks.map((x) => x.id)).toEqual([b.id]);
    expect((await backlog()).map((x) => x.id)).toEqual([c.id]);
    expect((await getDay()).note).toBe('Good day');
  });
});

describe('Frame Dashboard plan', () => {
  it('matches the shape frame-dashboard validates', async () => {
    await setDay('2026-10-12', { focus: 'Landing page copy done' });
    await addTask({ title: 'x'.repeat(200) });
    for (let i = 0; i < 25; i++) await addTask({ title: `Task ${i}`, date: '2026-10-13' });
    const plan = toFramePlan(await getWeek());
    expect(plan.weekOf).toBe('2026-10-12');
    expect(Object.keys(plan.days)).toEqual(['2026-10-12', '2026-10-13']);
    expect(plan.days['2026-10-12'].tasks[0].text.length).toBeLessThanOrEqual(200);
    expect(plan.days['2026-10-13'].tasks).toHaveLength(20);
    expect(plan.days['2026-10-12'].focus).toBe('Landing page copy done');
  });
});
