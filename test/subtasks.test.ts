import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addSubtasks, addTask, deleteSubtask, getDay, getTask, rollover, updateSubtask, updateTask } from '@/lib/daybook';
import { handle, startLocal } from '@/lib/localApi';
import { store } from '@/lib/storage';
import { fileStore, setStore } from '@/lib/store';

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

describe('subtasks', () => {
  it('adds them in order, at the end, skipping blank titles', async () => {
    const t = await addTask({ title: 'Write hero copy', subtasks: ['Outline tiers', '  '] });
    expect(t.subtasks.map((s) => s.title)).toEqual(['Outline tiers']);
    const next = await addSubtasks(t.id, ['Pull quotes', 'Send to Ana']);
    expect(next.subtasks.map((s) => [s.title, s.done])).toEqual([
      ['Outline tiers', false],
      ['Pull quotes', false],
      ['Send to Ana', false],
    ]);
    expect(new Set(next.subtasks.map((s) => s.id)).size).toBe(3);
  });

  it('ticks and renames one without finishing the task', async () => {
    const t = await addTask({ title: 'Readout', subtasks: ['Numbers'] });
    const id = t.subtasks[0].id;
    const ticked = await updateSubtask(t.id, id, { done: true, title: 'Pull the numbers' });
    expect(ticked.subtasks[0]).toEqual({ id, title: 'Pull the numbers', done: true });
    expect(ticked.done).toBe(false);
  });

  it('removes one', async () => {
    const t = await addTask({ title: 'Readout', subtasks: ['A', 'B'] });
    const next = await deleteSubtask(t.id, t.subtasks[0].id);
    expect(next.subtasks.map((s) => s.title)).toEqual(['B']);
  });

  it('refuses empty titles, unknown ids and more than 50', async () => {
    const t = await addTask({ title: 'Readout', subtasks: ['A'] });
    await expect(addSubtasks(t.id, [' '])).rejects.toThrow('required');
    await expect(updateSubtask(t.id, t.subtasks[0].id, { title: '' })).rejects.toThrow('cannot be empty');
    await expect(updateSubtask(t.id, 'nope', { done: true })).rejects.toThrow('no subtask');
    await expect(addSubtasks(t.id, Array.from({ length: 50 }, (_, i) => `Step ${i}`))).rejects.toThrow('more than 50');
  });

  it('travel with their task: edits, the backlog and rollover keep them', async () => {
    const t = await addTask({ title: 'Readout', date: '2026-10-11', subtasks: ['A'] });
    await updateTask(t.id, { title: 'Weekly readout', estimate: 60 });
    await rollover('2026-10-12');
    const day = await getDay('2026-10-12');
    expect(day.tasks[0].subtasks.map((s) => s.title)).toEqual(['A']);
    const moved = await updateTask(t.id, { date: 'backlog' });
    expect(moved.subtasks).toHaveLength(1);
  });

  it('reads tasks saved before subtasks existed as having none', async () => {
    const t = await addTask({ title: 'Old' });
    await store().put('tasks', t.id, { ...t, subtasks: undefined });
    expect((await getTask(t.id)).subtasks).toEqual([]);
    expect((await getDay()).tasks[0].subtasks).toEqual([]);
  });
});

describe('subtasks on this device', () => {
  it('answers the same routes as the server', async () => {
    const mem = new Map<string, string>();
    await startLocal({ getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v), removeItem: (k) => void mem.delete(k) }, { tz: 'UTC' });
    const created = await handle('POST', '/api/tasks', { text: 'Readout 1h', subtasks: ['Numbers'] });
    const task = (created.data as { task: { id: string; subtasks: { id: string }[] } }).task;
    expect(task.subtasks).toHaveLength(1);
    const added = await handle('POST', `/api/tasks/${task.id}/subtasks`, { title: 'Highlights' });
    expect(added.status).toBe(201);
    const sub = (added.data as { task: { subtasks: { id: string }[] } }).task.subtasks[1].id;
    const ticked = await handle('PATCH', `/api/tasks/${task.id}/subtasks/${sub}`, { done: true });
    expect((ticked.data as { task: { subtasks: { done: boolean }[] } }).task.subtasks[1].done).toBe(true);
    const removed = await handle('DELETE', `/api/tasks/${task.id}/subtasks/${sub}`);
    expect((removed.data as { task: { subtasks: unknown[] } }).task.subtasks).toHaveLength(1);
    expect((await handle('PATCH', `/api/tasks/${task.id}/subtasks/missing`, { done: true })).status).toBe(404);
  });
});
