// "On this device": the domain's store kept in the browser's localStorage,
// one JSON document. Nothing leaves the browser. Another tab writing the same
// document is picked up on the next read.

import type { Kind, Store } from './storage';

export const LOCAL_KEY = 'daybook.data';

export type LocalData = Partial<Record<Kind, Record<string, unknown>>>;

/** Anything with localStorage's getItem/setItem (the real one, or a test double). */
export interface KeyValue {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function readLocal(kv: KeyValue): LocalData {
  try {
    const data = JSON.parse(kv.getItem(LOCAL_KEY) || '{}');
    return data && typeof data === 'object' ? (data as LocalData) : {};
  } catch {
    return {};
  }
}

export function writeLocal(kv: KeyValue, data: LocalData) {
  // Throws when the browser's quota is full; the caller shows it as an error.
  kv.setItem(LOCAL_KEY, JSON.stringify(data));
}

export function localStore(kv: KeyValue): Store {
  const update = (fn: (d: LocalData) => void) => {
    const data = readLocal(kv);
    fn(data);
    writeLocal(kv, data);
  };
  return {
    async all<T>(kind: Kind) {
      return (readLocal(kv)[kind] || {}) as Record<string, T>;
    },
    async get<T>(kind: Kind, id: string) {
      return ((readLocal(kv)[kind] || {})[id] as T) ?? null;
    },
    async put<T>(kind: Kind, id: string, value: T) {
      update((d) => {
        d[kind] = { ...(d[kind] || {}), [id]: value };
      });
    },
    async del(kind: Kind, id: string) {
      update((d) => {
        if (d[kind]) delete d[kind]![id];
      });
    },
  };
}
