// "On this device": the same routes and JSON the server answers, answered in
// the browser by the same domain code over a localStorage store. The web app's
// api() sends requests here instead of over the network when the device mode
// is on. A plain function, so other hosts (a Mac app's web view) can call it.

import { getAppearance, setAppearance } from './appearanceStore';
import { artFor } from './art';
import { exportData, importData } from './backup';
import {
  addTask,
  type AddTaskInput,
  backlog,
  capacity,
  type Carry,
  deleteTask,
  getDay,
  getDayMeta,
  getWeek,
  NotFound,
  reopenDay,
  setCapacity,
  setDay,
  setWeekFocus,
  shutdown,
  type TaskPatch,
  updateTask,
} from './daybook';
import { type KeyValue, LOCAL_KEY, localStore } from './localStore';
import { setStore, store } from './storage';
import { addDays, mondayOf, setTimeZone, today, tzName } from './time';

export interface LocalReply {
  status: number;
  data: unknown;
}

let kv: KeyValue | null = null;
let locale: 'en' | 'es' = 'en';

/** Point the domain at this device: its storage, time zone and language. */
export async function startLocal(storage: KeyValue, opts: { tz?: string; locale?: string } = {}) {
  kv = storage;
  setStore(localStore(storage));
  setTimeZone(opts.tz || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  locale = opts.locale?.toLowerCase().startsWith('es') ? 'es' : 'en';
  const saved = await store().get<number>('meta', 'capacity');
  setCapacity(typeof saved === 'number' && saved > 0 ? saved : null);
}

async function session() {
  const day = today();
  return {
    cloud: false,
    local: true,
    authorized: true,
    owner: true,
    needsKey: false,
    locale,
    today: day,
    tz: tzName(),
    capacity: capacity(),
    storage: 'browser',
    linear: false,
    frame: false,
    art: artFor(day),
    weekArt: artFor(addDays(mondayOf(day), -1)),
    appearance: await getAppearance(),
    closedToday: Boolean((await getDayMeta(day)).shutdownAt),
  };
}

type Body = Record<string, unknown>;

async function route(method: string, url: URL, body: Body): Promise<unknown> {
  const q = (name: string) => url.searchParams.get(name) || undefined;
  const path = url.pathname;
  const task = path.match(/^\/api\/tasks\/([^/]+)$/);

  if (path === '/api/session' && method === 'GET') return session();
  if (path === '/api/day' && method === 'GET') return getDay(q('date'));
  if (path === '/api/day' && method === 'PUT') {
    const date = (body.date as string) || today();
    await setDay(date, { focus: body.focus as string | null | undefined, note: body.note as string | null | undefined });
    return { ...(await getDay(date)), warnings: [] };
  }
  if (path === '/api/week' && method === 'GET') return { ...(await getWeek(q('date'))), events: {} };
  if (path === '/api/week' && method === 'PUT') {
    const date = (body.date as string) || today();
    await setWeekFocus(date, (body.focus as string | null) ?? null);
    return { ...(await getWeek(date)), warnings: [] };
  }
  if (path === '/api/tasks' && method === 'GET') return { backlog: await backlog() };
  if (path === '/api/tasks' && method === 'POST') return { task: await addTask(body as unknown as AddTaskInput), warnings: [] };
  if (task && method === 'PATCH') return { task: await updateTask(task[1], body as TaskPatch), warnings: [] };
  if (task && method === 'DELETE') {
    await deleteTask(task[1]);
    return { deleted: task[1] };
  }
  if (path === '/api/shutdown' && method === 'POST') {
    const r = await shutdown(body.date as string | undefined, { note: body.note as string | undefined, carry: body.carry as Record<string, Carry> });
    return { ...r, warnings: [] };
  }
  if (path === '/api/shutdown' && method === 'DELETE') return { day: await reopenDay(q('date')), warnings: [] };
  if (path === '/api/appearance' && method === 'GET') return getAppearance();
  if (path === '/api/appearance' && method === 'PUT') return setAppearance(body);
  if (path === '/api/capacity' && method === 'PUT') {
    const minutes = Number(body.minutes);
    if (!Number.isInteger(minutes) || minutes < 60 || minutes > 960) throw new Error('minutes must be a whole number from 60 to 960');
    await store().put('meta', 'capacity', minutes);
    setCapacity(minutes);
    return { capacity: minutes };
  }
  if (path === '/api/export' && method === 'GET') return exportData();
  if (path === '/api/import' && method === 'POST') return importData(body.backup, body.replace ? 'replace' : 'merge');
  if (path === '/api/data' && method === 'DELETE') {
    kv?.removeItem(LOCAL_KEY);
    setCapacity(null);
    return { erased: true };
  }
  throw new NotFound(locale === 'es' ? 'No está disponible en este dispositivo.' : 'Not available on this device.');
}

/** Answer one request the way app/api would, errors included. */
export async function handle(method: string, path: string, body?: unknown): Promise<LocalReply> {
  if (!kv) return { status: 503, data: { error: 'Daybook on this device has not started' } };
  try {
    const data = await route(method.toUpperCase(), new URL(path, 'http://device'), (body as Body) || {});
    return { status: method.toUpperCase() === 'POST' && path === '/api/tasks' ? 201 : 200, data };
  } catch (err) {
    const message = (err as Error).message || 'something went wrong';
    if (err instanceof NotFound) return { status: 404, data: { error: message } };
    // Same reading of errors as lib/http.ts; a full browser quota is a 507.
    if ((err as Error).name === 'QuotaExceededError') return { status: 507, data: { error: message } };
    const status = /must|required|cannot|longer than|can't read/.test(message) ? 400 : 500;
    return { status, data: { error: message } };
  }
}
