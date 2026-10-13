// Storage: Redis hashes, one per kind (tasks, days, weeks). Each record is its
// own hash field, so the web app and an agent editing different tasks at the
// same moment never overwrite each other.
//
// Upstash Redis when its REST env vars are set (Vercel's integration sets
// KV_REST_API_*), otherwise a JSON file in .data/ for local development.

import { Redis } from '@upstash/redis';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type Kind = 'tasks' | 'days' | 'weeks' | 'meta' | 'tokens';

export interface Store {
  all<T>(kind: Kind): Promise<Record<string, T>>;
  get<T>(kind: Kind, id: string): Promise<T | null>;
  put<T>(kind: Kind, id: string, value: T): Promise<void>;
  del(kind: Kind, id: string): Promise<void>;
}

const PREFIX = process.env.DAYBOOK_PREFIX || 'daybook';

function redisStore(url: string, token: string): Store {
  const redis = new Redis({ url, token });
  const key = (kind: Kind) => `${PREFIX}:${kind}`;
  return {
    async all<T>(kind: Kind) {
      return ((await redis.hgetall<Record<string, T>>(key(kind))) || {}) as Record<string, T>;
    },
    async get<T>(kind: Kind, id: string) {
      return ((await redis.hget<T>(key(kind), id)) ?? null) as T | null;
    },
    async put<T>(kind: Kind, id: string, value: T) {
      await redis.hset(key(kind), { [id]: value });
    },
    async del(kind: Kind, id: string) {
      await redis.hdel(key(kind), id);
    },
  };
}

type FileData = Partial<Record<Kind, Record<string, unknown>>>;

export function fileStore(file: string): Store {
  let queue: Promise<unknown> = Promise.resolve();
  const read = async (): Promise<FileData> => {
    try {
      return JSON.parse(await readFile(file, 'utf8'));
    } catch {
      return {};
    }
  };
  // Serialise writes in this process; good enough for one developer's machine.
  const update = (fn: (d: FileData) => void) =>
    (queue = queue.then(async () => {
      const data = await read();
      fn(data);
      await mkdir(path.dirname(file), { recursive: true });
      const tmp = `${file}.tmp`;
      await writeFile(tmp, JSON.stringify(data, null, 2));
      await rename(tmp, file);
    }));
  return {
    async all<T>(kind: Kind) {
      await queue;
      return ((await read())[kind] || {}) as Record<string, T>;
    },
    async get<T>(kind: Kind, id: string) {
      await queue;
      return (((await read())[kind] || {})[id] as T) ?? null;
    },
    async put<T>(kind: Kind, id: string, value: T) {
      await update((d) => {
        d[kind] = { ...(d[kind] || {}), [id]: value };
      });
    },
    async del(kind: Kind, id: string) {
      await update((d) => {
        if (d[kind]) delete d[kind]![id];
      });
    },
  };
}

let cached: Store | null = null;

export function store(): Store {
  if (cached) return cached;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (url && token) cached = redisStore(url, token);
  else if (process.env.VERCEL) throw new Error('Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN (Vercel has no writable disk).');
  else cached = fileStore(process.env.DAYBOOK_DATA_FILE || path.join(process.cwd(), '.data', 'daybook.json'));
  return cached;
}

export function setStore(s: Store | null) {
  cached = s;
}

export const storageKind = () =>
  process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL ? 'upstash' : 'file';
