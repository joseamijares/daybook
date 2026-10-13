'use client';

import { useMemo } from 'react';
import type { Task } from '@/lib/daybook';
import { api, useSession } from './client';

// Every screen edits tasks the same way; each call reloads that screen's data.
export function useOps(reload: () => Promise<void>) {
  const { run, toast, t, refreshSession } = useSession();
  return useMemo(
    () => ({
      add: (body: { text: string; date?: string | null }) => run(() => api('/api/tasks', { method: 'POST', body }), reload),
      toggle: (task: Task) => run(() => api(`/api/tasks/${task.id}`, { method: 'PATCH', body: { done: !task.done } }), reload),
      patch: (id: string, body: Record<string, unknown>) => run(() => api(`/api/tasks/${id}`, { method: 'PATCH', body }), reload),
      remove: (id: string) => run(() => api(`/api/tasks/${id}`, { method: 'DELETE' }), reload),
      // Put ids on a day in this order (drag and drop).
      arrange: (date: string | null, ids: string[]) =>
        run(async () => {
          for (const [i, id] of ids.entries()) await api(`/api/tasks/${id}`, { method: 'PATCH', body: { date, order: i + 1 } });
        }, reload),
      setFocus: (date: string, focus: string) => run(() => api('/api/day', { method: 'PUT', body: { date, focus } }), reload),
      setWeekFocus: (date: string, focus: string) => run(() => api('/api/week', { method: 'PUT', body: { date, focus } }), reload),
      syncLinear: () =>
        run(async () => {
          const r = await api<{ added: number; closed: number; open: number }>('/api/linear', { method: 'POST' });
          toast(`Linear: ${r.open} open, ${r.added} new, ${r.closed} closed`);
          await refreshSession();
        }, reload),
      sendToFrame: (date?: string) =>
        run(async () => {
          const r = await api<{ pulled: { done: number; undone: number; added: number; removed: number; focus: number } }>('/api/frame', { method: 'POST', body: { date } });
          const changes = Object.values(r.pulled).reduce((a, b) => a + b, 0);
          toast(changes ? `${t.sentToFrame} · ${changes} ↓` : t.sentToFrame);
          await refreshSession();
        }, reload),
    }),
    [run, reload, toast, t, refreshSession],
  );
}
