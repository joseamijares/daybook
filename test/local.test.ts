import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { handle, startLocal } from '@/lib/localApi';
import { LOCAL_KEY } from '@/lib/localStore';
import { setStore } from '@/lib/storage';
import { setTimeZone } from '@/lib/time';

// localStorage, in memory.
const memory = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    raw: m,
  };
};

type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const call = async (method: string, path: string, body?: unknown) => {
  const r = await handle(method, path, body);
  return { status: r.status, data: r.data as J };
};

describe('on this device', () => {
  let kv: ReturnType<typeof memory>;
  beforeEach(async () => {
    kv = memory();
    await startLocal(kv, { tz: 'Europe/Paris', locale: 'es-MX' });
  });
  afterEach(() => {
    setStore(null);
    setTimeZone(null);
  });

  it('answers the session without a server', async () => {
    const { status, data } = await call('GET', '/api/session');
    expect(status).toBe(200);
    expect(data).toMatchObject({ local: true, cloud: false, authorized: true, storage: 'browser', tz: 'Europe/Paris', locale: 'es', linear: false, frame: false });
    expect(data.art?.slug).toBeTruthy();
  });

  it('adds, edits, plans and deletes tasks, kept in localStorage', async () => {
    const added = await call('POST', '/api/tasks', { text: 'Draft deck 45m #client' });
    expect(added.status).toBe(201);
    expect(added.data.task).toMatchObject({ title: 'Draft deck', estimate: 45, tag: 'client' });
    const id = added.data.task.id;
    expect(kv.raw.get(LOCAL_KEY)).toContain('Draft deck');

    const today = (await call('GET', '/api/session')).data.today;
    await call('PATCH', `/api/tasks/${id}`, { date: today });
    const day = await call('GET', `/api/day?date=${today}`);
    expect(day.data.tasks.map((t: J) => t.id)).toEqual([id]);
    expect(day.data.planned).toBe(45);

    expect((await call('PATCH', `/api/tasks/${id}`, { estimate: 'soon' })).status).toBe(400);
    expect((await call('DELETE', `/api/tasks/${id}`)).status).toBe(200);
    expect((await call('PATCH', `/api/tasks/${id}`, { done: true })).status).toBe(404);
  });

  it('closes and reopens the day', async () => {
    const { data: s } = await call('GET', '/api/session');
    const { data: t } = await call('POST', '/api/tasks', { title: 'Open thing', date: s.today });
    const closed = await call('POST', '/api/shutdown', { note: 'Good day', carry: { [t.task.id]: 'backlog' } });
    expect(closed.data.moved).toBe(1);
    expect((await call('GET', '/api/session')).data.closedToday).toBe(true);
    expect((await call('GET', '/api/tasks')).data.backlog.map((x: J) => x.id)).toContain(t.task.id);
    await call('DELETE', `/api/shutdown?date=${s.today}`);
    expect((await call('GET', '/api/session')).data.closedToday).toBe(false);
  });

  it('exports, erases and imports a copy', async () => {
    await call('POST', '/api/tasks', { text: 'Keep me 1h', date: null });
    await call('PUT', '/api/appearance', { palette: 'nocturne' });
    const backup = (await call('GET', '/api/export')).data;
    expect(backup.daybook).toBe(1);

    await call('DELETE', '/api/data');
    expect((await call('GET', '/api/tasks')).data.backlog).toEqual([]);

    expect((await call('POST', '/api/import', { backup: { hello: 1 } })).status).toBe(400);
    const imported = await call('POST', '/api/import', { backup, replace: true });
    expect(imported.data.tasks).toBe(1);
    expect((await call('GET', '/api/tasks')).data.backlog[0].title).toBe('Keep me');
    expect((await call('GET', '/api/appearance')).data.palette).toBe('nocturne');
  });

  it('keeps its own day length and says what it cannot do', async () => {
    await call('PUT', '/api/capacity', { minutes: 300 });
    expect((await call('GET', '/api/session')).data.capacity).toBe(300);
    expect((await call('PUT', '/api/capacity', { minutes: 5 })).status).toBe(400);
    const linear = await call('POST', '/api/linear');
    expect(linear.status).toBe(404);
    expect(linear.data.error).toMatch(/dispositivo/);
  });
});
