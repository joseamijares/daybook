import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addTask, backlog, getDay, getWeek, setDay, updateTask } from '@/lib/daybook';
import { type FramePlan, mergeFromFrame, toFramePlan } from '@/lib/frame';
import { fileStore, setStore } from '@/lib/store';

const MON = '2026-10-12';

beforeEach(() => {
  setStore(fileStore(path.join(mkdtempSync(path.join(tmpdir(), 'daybook-')), 'db.json')));
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-12T15:00:00Z'));
  process.env.DAYBOOK_TZ = 'UTC';
});
afterEach(() => {
  vi.useRealTimers();
  setStore(null);
});

// The plan Daybook would push right now: what becomes "base" after a sync.
const pushed = async () => toFramePlan(await getWeek(MON));
const clone = (p: FramePlan): FramePlan => JSON.parse(JSON.stringify(p));
const titles = async (date = MON) => (await getDay(date)).tasks.map((t) => `${t.done ? '✓' : '○'} ${t.title}`);

describe('Frame merge', () => {
  it('a tick on Frame Desk reaches Daybook', async () => {
    await addTask({ title: 'Write copy' });
    const base = await pushed();
    const remote = clone(base);
    remote.days[MON].tasks[0].done = true;
    const r = await mergeFromFrame(await getWeek(MON), remote, base);
    expect(r.done).toBe(1);
    expect(await titles()).toEqual(['✓ Write copy']);
  });

  it('an untick in Daybook survives when Frame did not change', async () => {
    const t = await addTask({ title: 'Write copy' });
    await updateTask(t.id, { done: true });
    const base = await pushed();
    await updateTask(t.id, { done: false });
    await mergeFromFrame(await getWeek(MON), clone(base), base);
    expect(await titles()).toEqual(['○ Write copy']);
  });

  it('a done state changed and changed back counts as unchanged', async () => {
    const t = await addTask({ title: 'Write copy' });
    const base = await pushed();
    const remote = clone(base);
    remote.days[MON].tasks[0].done = true;
    await updateTask(t.id, { title: 'Write copy' }); // untouched done state…
    await updateTask(t.id, { done: true });
    await updateTask(t.id, { done: false }); // …changed and changed back: equal to base
    const r = await mergeFromFrame(await getWeek(MON), remote, base);
    expect(r.done).toBe(1); // local equals base, so Frame's tick applies
  });

  it('a to-do added on Frame is added to Daybook', async () => {
    await addTask({ title: 'Write copy' });
    const base = await pushed();
    const remote = clone(base);
    remote.days[MON].tasks.push({ text: 'Call the bank', done: false, tag: 'Personal' });
    const r = await mergeFromFrame(await getWeek(MON), remote, base);
    expect(r.added).toBe(1);
    expect(await titles()).toEqual(['○ Write copy', '○ Call the bank']);
    expect((await getDay()).tasks[1].tag).toBe('Personal');
  });

  it('a to-do removed on Frame goes to the backlog, not the bin', async () => {
    await addTask({ title: 'Write copy' });
    await addTask({ title: 'Call the bank' });
    const base = await pushed();
    const remote = clone(base);
    remote.days[MON].tasks = remote.days[MON].tasks.filter((t) => t.text !== 'Call the bank');
    const r = await mergeFromFrame(await getWeek(MON), remote, base);
    expect(r.removed).toBe(1);
    expect(await titles()).toEqual(['○ Write copy']);
    expect((await backlog()).map((t) => t.title)).toEqual(['Call the bank']);
  });

  it('a task Daybook removed is not brought back from Frame', async () => {
    const t = await addTask({ title: 'Old idea' });
    const base = await pushed();
    await updateTask(t.id, { date: 'backlog' });
    const r = await mergeFromFrame(await getWeek(MON), clone(base), base);
    expect(r.added).toBe(0);
    expect(await titles()).toEqual([]);
  });

  it('first sync imports what Frame has and only promotes to done', async () => {
    const mine = await addTask({ title: 'Already here' });
    await updateTask(mine.id, { done: true });
    const remote: FramePlan = {
      weekOf: MON,
      focus: 'Ship it',
      days: {
        [MON]: { focus: 'Copy before lunch', tasks: [{ text: 'Already here', done: false, tag: null }, { text: 'From the TV', done: true, tag: null }] },
        '2026-10-13': { focus: null, tasks: [{ text: 'Tuesday thing', done: false, tag: null }] },
      },
    };
    const r = await mergeFromFrame(await getWeek(MON), remote, null);
    expect(r.added).toBe(2);
    expect(await titles()).toEqual(['✓ Already here', '✓ From the TV']);
    expect(await titles('2026-10-13')).toEqual(['○ Tuesday thing']);
    expect((await getDay()).focus).toBe('Copy before lunch');
    expect((await getWeek(MON)).focus).toBe('Ship it');
  });

  it('identical titles on one day never cross-match', async () => {
    await addTask({ title: 'Review' });
    await addTask({ title: 'Review' });
    const base = await pushed();
    const remote = clone(base);
    remote.days[MON].tasks[1].done = true;
    await mergeFromFrame(await getWeek(MON), remote, base);
    expect((await getDay()).tasks.filter((t) => t.done)).toHaveLength(1);
  });

  it('a focus edited on Frame applies unless Daybook changed it too', async () => {
    await setDay(MON, { focus: 'Original' });
    await setDay('2026-10-13', { focus: 'Tuesday' });
    const base = await pushed();
    const remote = clone(base);
    remote.days[MON].focus = 'From Frame';
    remote.days['2026-10-13'].focus = 'Also from Frame';
    await setDay('2026-10-13', { focus: 'Changed in Daybook' });
    await mergeFromFrame(await getWeek(MON), remote, base);
    expect((await getDay(MON)).focus).toBe('From Frame');
    expect((await getDay('2026-10-13')).focus).toBe('Changed in Daybook');
  });
});
