import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as versionGet, POST as versionPost } from '@/app/tv/api/version/route';
import { PUT as eventsPut } from '@/app/tv/api/events/route';
import { GET as planGet, PUT as planPut } from '@/app/tv/api/plan/route';
import { GET as settingsGet, PUT as settingsPut } from '@/app/tv/api/settings/route';
import { GET as weekGet } from '@/app/tv/api/week/route';
import { setAppearance } from '@/lib/appearanceStore';
import { authorized, screenAuthorized } from '@/lib/auth';
import { addTask, backlog, getWeek, setDay, setWeekFocus, updateTask } from '@/lib/daybook';
import { fileStore, setStore } from '@/lib/store';
import { nextVersion, planVersion, type Store } from '@/lib/storage';
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

  it('says when the Frame can\'t be read, instead of showing a free day', async () => {
    process.env.FRAME_DASHBOARD_URL = 'https://frame.test';
    process.env.FRAME_DASHBOARD_WRITE_KEY = 'w';
    const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    try {
      const w = await tvWeek();
      expect(w.errors).toEqual(['Meetings unavailable: offline']);
      expect(w.days[0].events).toEqual([]);
      // The painting falls back to Daybook's own.
      expect(w.days[0].art.image).toMatch(/^\/art\//);
    } finally {
      fetch.mockRestore();
      delete process.env.FRAME_DASHBOARD_URL;
      delete process.env.FRAME_DASHBOARD_WRITE_KEY;
    }
  });

  it('asks the Frame once for the whole week', async () => {
    vi.setSystemTime(new Date('2026-11-09T15:00:00Z')); // a Monday no other test caches
    process.env.FRAME_DASHBOARD_URL = 'https://frame.test';
    process.env.FRAME_DASHBOARD_WRITE_KEY = 'w';
    const days = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15'].map((date) => ({
      date,
      events: date === '2026-11-10' ? [{ title: 'Standup', location: null, allDay: false, date, start: `${date}T15:00:00Z`, end: `${date}T15:15:00Z` }] : [],
    }));
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json({ days }));
    try {
      const w = await tvWeek();
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(w.errors).toEqual([]);
      expect(w.days[1].events.map((e) => e.title)).toEqual(['Standup']);
    } finally {
      fetch.mockRestore();
      delete process.env.FRAME_DASHBOARD_URL;
      delete process.env.FRAME_DASHBOARD_WRITE_KEY;
    }
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

describe('the version stamp', () => {
  it('never repeats, even within one millisecond', () => {
    const a = nextVersion();
    const b = nextVersion();
    expect(Number(b)).toBeGreaterThan(Number(a));
  });

  it("doesn't fail a write that already happened", async () => {
    const data: Record<string, unknown> = {};
    const flaky: Store = {
      all: async () => ({}),
      get: async () => null,
      put: async (kind, id, value) => {
        if (id === 'version') throw new Error('redis down');
        data[`${kind}:${id}`] = value;
      },
      del: async () => {},
    };
    setStore(flaky);
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(addTask({ title: 'Once' })).resolves.toMatchObject({ title: 'Once' });
    expect(Object.keys(data)).toHaveLength(1);
    err.mockRestore();
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

const master = { authorization: 'Bearer master', 'content-type': 'application/json' };
const send = (url: string, method: string, body: unknown, headers: Record<string, string> = master) =>
  req(url, { method, headers, body: JSON.stringify(body) });

describe('Frame Desk against Daybook', () => {
  // Frame Desk's edit: read the plan, change a day, save the whole week.
  async function edit(change: (tasks: { text: string; done: boolean; tag: string | null }[]) => void) {
    const plan = await (await planGet(req('/tv/api/plan?week=2026-10-12', { headers: master }), undefined)).json();
    const day = plan.days['2026-10-12'] || { focus: null, tasks: [] };
    change(day.tasks);
    plan.days['2026-10-12'] = day;
    return planPut(send('/tv/api/plan', 'PUT', plan), undefined);
  }

  it('ticks, adds and removes to-dos in Daybook', async () => {
    const a = await addTask({ title: 'Write tests', date: '2026-10-12' });
    await addTask({ title: 'Review', date: '2026-10-12' });

    expect((await edit((t) => (t.find((x) => x.text === 'Write tests')!.done = true))).status).toBe(200);
    expect((await edit((t) => t.push({ text: 'Call the framer', done: false, tag: null }))).status).toBe(200);
    expect((await edit((t) => t.splice(t.findIndex((x) => x.text === 'Review'), 1))).status).toBe(200);

    const day = (await getWeek('2026-10-12')).days[0];
    expect(day.tasks.map((t) => [t.title, t.done])).toEqual([
      ['Write tests', true],
      ['Call the framer', false],
    ]);
    expect(day.tasks[0].id).toBe(a.id);
    // Removed on the Frame: to the backlog, never deleted.
    expect((await backlog()).map((t) => t.title)).toEqual(['Review']);
  });

  it("keeps what Daybook changed after Frame Desk's read", async () => {
    const a = await addTask({ title: 'Write tests', date: '2026-10-12' });
    const plan = await (await planGet(req('/tv/api/plan?week=2026-10-12', { headers: master }), undefined)).json();
    await updateTask(a.id, { done: true }); // in Daybook, meanwhile
    plan.days['2026-10-12'].focus = 'From the Mac';
    await planPut(send('/tv/api/plan', 'PUT', plan), undefined);
    const day = (await getWeek('2026-10-12')).days[0];
    expect(day.tasks[0].done).toBe(true);
    expect(day.focus).toBe('From the Mac');
  });

  it('refuses a plan that is not a week, and the screen key', async () => {
    expect((await planPut(send('/tv/api/plan', 'PUT', { weekOf: '2026-10-13', days: {} }), undefined)).status).toBe(400);
    expect((await planPut(send('/tv/api/plan', 'PUT', { weekOf: '2026-10-12', days: { '2026-10-20': { tasks: [] } } }), undefined)).status).toBe(400);
    expect((await planGet(req('/tv/api/plan?k=screen'), undefined)).status).toBe(401);
    expect((await planPut(send('/tv/api/plan?k=screen', 'PUT', { weekOf: '2026-10-12', days: {} }, {}), undefined)).status).toBe(401);
  });

  it('switches the design and keeps the packs', async () => {
    const before = await (await settingsGet(req('/tv/api/settings?k=screen'), undefined)).json();
    expect(before).toMatchObject({ enabled: ['impressionists'], layout: 'bleed' });
    expect(before.layouts.map((l: { id: string }) => l.id)).toEqual(['bleed', 'salon', 'painting']);
    expect((await settingsPut(send('/tv/api/settings', 'PUT', { layout: 'salon' }), undefined)).status).toBe(200);
    expect((await tvWeek()).layout).toBe('salon');
    expect((await settingsPut(send('/tv/api/settings', 'PUT', { layout: 'mural' }), undefined)).status).toBe(400);
    expect((await settingsPut(send('/tv/api/settings', 'PUT', { packs: ['nope'] }), undefined)).status).toBe(400);
    expect((await settingsPut(send('/tv/api/settings', 'PUT', {}), undefined)).status).toBe(400);
    expect((await settingsPut(send('/tv/api/settings?k=screen', 'PUT', { layout: 'bleed' }, {}), undefined)).status).toBe(401);
  });

  it("shows the Mac's meetings on the TV, once, and moves the version", async () => {
    const v = await planVersion();
    vi.setSystemTime(new Date('2026-10-12T15:00:05Z'));
    const res = await eventsPut(
      send('/tv/api/events', 'PUT', {
        weekOf: '2026-10-12',
        source: 'Frame Desk',
        events: [
          { title: 'Standup', start: '2026-10-13T15:00:00Z', end: '2026-10-13T15:15:00Z' },
          { title: 'Standup', start: '2026-10-13T15:00:00Z', end: '2026-10-13T15:15:00Z' },
          { title: 'Holiday', allDay: true, date: '2026-10-14' },
          { title: 'Next week', start: '2026-10-20T15:00:00Z' },
        ],
      }),
      undefined,
    );
    expect(await res.json()).toMatchObject({ ok: true, weekOf: '2026-10-12', count: 3 });
    expect(await planVersion()).not.toBe(v);
    const w = await tvWeek();
    expect(w.days[1].events.map((e) => e.title)).toEqual(['Standup']);
    expect(w.days[2].events).toEqual([{ title: 'Holiday', location: null, allDay: true, date: '2026-10-14' }]);
    expect(w.eventsSyncedAt).not.toBeNull();
    expect((await eventsPut(send('/tv/api/events', 'PUT', { weekOf: '2026-10-12', events: [{ start: 'x' }] }), undefined)).status).toBe(400);
  });
});
