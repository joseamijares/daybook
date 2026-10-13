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

/** The store in use. Fails loudly if nothing registered one. */
export function store(): Store {
  if (!current) {
    if (!factory) throw new Error('No store: import lib/store (server) or call setStore (browser) first.');
    current = factory();
  }
  return current;
}

/** Use this store from now on (tests, the browser's local store). */
export function setStore(s: Store | null) {
  current = s;
}

/** How to make the store on first use (the server registers Redis or a file). */
export function registerStore(make: () => Store) {
  factory = make;
}
