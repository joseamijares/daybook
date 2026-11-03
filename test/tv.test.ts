import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as versionGet, POST as versionPost } from '@/app/tv/api/version/route';
import { GET as weekGet } from '@/app/tv/api/week/route';
import { setAppearance } from '@/lib/appearanceStore';
import { authorized, screenAuthorized } from '@/lib/auth';
import { addTask, setDay, setWeekFocus, updateTask } from '@/lib/daybook';
import { fileStore, setStore } from '@/lib/store';
import { planVersion } from '@/lib/storage';
import { tvWeek } from '@/lib/tv';

const req = (url: string, init: RequestInit = {}) => new Request(`http://localhost${url}`, init);

beforeEach(() => {
  setStore(fileStore(path.join(mkdtempSync(path.join(tmpdir(), 'daybook-')), 'db.json')));
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-12T15:00:00Z')); // Monday
  process.env.DAYBOOK_TZ = 'UTC';
  process.env.DAYBOOK_KEY = 'master';
  process.env.DAYBOOK_SCREEN_KEY = 'screen';
  delete process.env.FRAME_DASHBOARD_URL;
  delete process.env.FRAME_DASHBOARD_WRITE_KEY;
});
afterEach(() => {
  vi.useRealTimers();
  delete process.env.DAYBOOK_KEY;
  delete process.env.DAYBOOK_SCREEN_KEY;
  setStore(null);
});

describe('the TV week', () => {
  it('has the shape the Frame screen draws', async () => {
    await setWeekFocus('2026-10-12', 'Ship the TV');
    await setDay('2026-10-12', { focus: 'Routes done' });
    const a = await addTask({ title: 'Write tests', date: '2026-10-12' });
    await addTask({ title: 'Review', date: '2026-10-12', source: { type: 'linear', id: 'x', key: 'APP-1', url: 'https://linear.app' } });
    await updateTask(a.id, { done: true });

    const w = await tvWeek();
    expect(w).toMatchObject({ tz: 'UTC', locale: 'en', layout: 'bleed', today: '2026-10-12', weekOf: '2026-10-12', focus: 'Ship the TV', planned: true, errors: [] });
    expect(w.days.map((d) => d.date)).toEqual(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']);
    const monday = w.days[0];
    expect(monday.focus).toBe('Routes done');
    // Unfinished first; the Linear key is the tag.
    expect(monday.tasks).toEqual([
      { text: 'Review', done: false, tag: 'APP-1' },
      { text: 'Write tests', done: true, tag: null },
    ]);
    expect(monday.events).toEqual([]);
    expect(monday.art.image).toMatch(/^\/art\/.+\.webp$/);
    expect(w.tomorrow?.date).toBe('2026-10-13');
    expect(w.planUpdatedAt).not.toBeNull();
  });

  it('reads tomorrow from next week on a Sunday', async () => {
    vi.setSystemTime(new Date('2026-10-18T15:00:00Z'));
    await setDay('2026-10-19', { focus: 'Monday plan' });
    const w = await tvWeek();
    expect(w.weekOf).toBe('2026-10-12');
    expect(w.tomorrow).toMatchObject({ date: '2026-10-19', focus: 'Monday plan' });
  });

  it('is unplanned on an empty week', async () => {
    expect((await tvWeek()).planned).toBe(false);
  });
});

describe('the version', () => {
  it('moves with the plan, not with the appearance', async () => {
    expect(await planVersion()).toBe('0');
    await addTask({ title: 'One' });
    const v1 = await planVersion();
    expect(v1).not.toBe('0');
    vi.setSystemTime(new Date('2026-10-12T15:00:01Z'));
    await setAppearance({ palette: 'modern' });
    expect(await planVersion()).toBe(v1);
    await setDay('2026-10-12', { focus: 'Two' });
    expect(await planVersion()).not.toBe(v1);
  });
});

describe('the screen key', () => {
  it('reads the TV routes and nothing else', async () => {
    expect(await screenAuthorized(req('/tv/api/week?k=screen'))).toBe(true);
    expect(await screenAuthorized(req('/tv/api/week', { headers: { authorization: 'Bearer screen' } }))).toBe(true);
    expect(await screenAuthorized(req('/tv/api/week?k=wrong'))).toBe(false);
    expect(await screenAuthorized(req('/tv/api/week?key=master'))).toBe(true);
    expect(await authorized(req('/api/day?key=screen'))).toBe(false);
    expect(await authorized(req('/api/day', { headers: { authorization: 'Bearer screen' } }))).toBe(false);

    expect((await weekGet(req('/tv/api/week?k=screen'), undefined)).status).toBe(200);
    expect((await weekGet(req('/tv/api/week'), undefined)).status).toBe(401);
    const v = await versionGet(req('/tv/api/version?k=screen'), undefined);
    expect(await v.json()).toEqual({ version: '0', build: 'dev' });
    // Bumping is a write: not with the screen key.
    expect((await versionPost(req('/tv/api/version?k=screen', { method: 'POST' }), undefined)).status).toBe(401);
    expect((await versionPost(req('/tv/api/version', { method: 'POST', headers: { authorization: 'Bearer master' } }), undefined)).status).toBe(200);
  });

  it('is off when unset', async () => {
    delete process.env.DAYBOOK_SCREEN_KEY;
    expect(await screenAuthorized(req('/tv/api/week?k='))).toBe(false);
    expect(await screenAuthorized(req('/tv/api/week?k=screen'))).toBe(false);
  });
});
