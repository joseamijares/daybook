// The storage interface the domain talks to, with no Node or browser imports,
// so lib/daybook.ts runs on the server and, for "on this device", in the
// browser. Whoever starts the app picks the store: lib/store.ts on the server
// (Upstash Redis or a JSON file), lib/localStore.ts in the browser.

export type Kind = 'tasks' | 'days' | 'weeks' | 'meta' | 'tokens';

export interface Store {
  all<T>(kind: Kind): Promise<Record<string, T>>;
  get<T>(kind: Kind, id: string): Promise<T | null>;
  put<T>(kind: Kind, id: string, value: T): Promise<void>;
  del(kind: Kind, id: string): Promise<void>;
}

let current: Store | null = null;
let factory: (() => Store) | null = null;

// A change to the plan (tasks, days, weeks, the TV's settings and meetings) also stamps
// meta "version", so a screen can poll that one small value instead of the
// whole week (the TV asks /tv/api/version every 20 seconds).
export const VERSION = 'version';
const watched = (kind: Kind, id: string) => kind === 'tasks' || kind === 'days' || kind === 'weeks' || (kind === 'meta' && (id === 'tv' || id.startsWith('tv:')));

// From the clock, but always past the last one, so two writes in one millisecond still differ.
let lastVersion = 0;
export const nextVersion = () => String((lastVersion = Math.max(Date.now(), lastVersion + 1)));

function stamped(s: Store): Store {
  // Best effort: the write itself already happened, so a failed stamp mustn't fail it
  // (a retry would add the task twice). The TV catches up on its next full refresh.
  const stamp = () => s.put('meta', VERSION, nextVersion()).catch((err) => console.error('version stamp failed', err));
  return {
    all: <T>(kind: Kind) => s.all<T>(kind),
    get: <T>(kind: Kind, id: string) => s.get<T>(kind, id),
    async put<T>(kind: Kind, id: string, value: T) {
      await s.put(kind, id, value);
      if (watched(kind, id)) await stamp();
    },
    async del(kind: Kind, id: string) {
      await s.del(kind, id);
      if (watched(kind, id)) await stamp();
    },
  };
}

/** The store in use. Fails loudly if nothing registered one. */
export function store(): Store {
  if (!current) {
    if (!factory) throw new Error('No store: import lib/store (server) or call setStore (browser) first.');
    current = stamped(factory());
  }
  return current;
}

/** Use this store from now on (tests, the browser's local store). */
export function setStore(s: Store | null) {
  current = s && stamped(s);
}

/** When the plan last changed ("0" if never). Redis may hand a numeric string back as a number. */
export async function planVersion(): Promise<string> {
  return String((await store().get<string | number>('meta', VERSION)) ?? '0');
}

/** How to make the store on first use (the server registers Redis or a file). */
export function registerStore(make: () => Store) {
  factory = make;
}
