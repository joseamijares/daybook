// "On this device" keeps the only copy of your days in one browser, so now and
// then it asks you to keep a copy (Today's foot). Pure and dependency-free, so
// the browser can import it without the store.

const DAY = 24 * 60 * 60 * 1000;
/** How long "on this device" waits after the last copy (or the start) before asking for another. */
export const COPY_EVERY = 7 * DAY;

/**
 * Whether "on this device" should ask for a copy now: a week after the last
 * one, or a week after starting when there is none yet, unless it was put off
 * until `later`. `days` is how long ago the last copy was, null when there is
 * none. Times are epoch milliseconds.
 */
export function copyReminder(s: { copiedAt: number | null; since: number | null; later: number | null }, now: number) {
  const from = s.copiedAt ?? s.since ?? now;
  const due = now - from >= COPY_EVERY && !(s.later && now < s.later);
  return { due, days: s.copiedAt === null ? null : Math.floor((now - s.copiedAt) / DAY) };
}
