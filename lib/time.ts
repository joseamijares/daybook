// Dates are plain YYYY-MM-DD strings in the configured zone. "Today" is
// always decided by DAYBOOK_TZ, never by the server's or the agent's clock.
// On this device (no server), the browser's own zone is set instead.

let tzOverride: string | null = null;
export const tzName = () => tzOverride || process.env.DAYBOOK_TZ || 'UTC';
export const setTimeZone = (tz: string | null) => {
  tzOverride = tz;
};

export function isYmd(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}

export function ymdInTz(d: Date, tz = tzName()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(d)
    .reduce<Record<string, string>>((acc, p) => ((acc[p.type] = p.value), acc), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export const today = () => ymdInTz(new Date());

export function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function mondayOf(ymd: string): string {
  const dow = new Date(`${ymd}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(ymd, dow === 0 ? -6 : 1 - dow);
}

export const weekDays = (monday: string) => Array.from({ length: 7 }, (_, i) => addDays(monday, i));

// "today", "tomorrow", "backlog", a weekday name or YYYY-MM-DD → date or null (backlog).
export function resolveDate(input: unknown, base = today()): string | null | undefined {
  if (input === undefined) return undefined;
  if (input === null || input === '' || input === 'backlog') return null;
  if (typeof input !== 'string') throw new Error('date must be a string');
  const s = input.trim().toLowerCase();
  if (s === 'today' || s === 'hoy') return base;
  if (s === 'tomorrow' || s === 'mañana' || s === 'manana') return addDays(base, 1);
  if (s === 'yesterday' || s === 'ayer') return addDays(base, -1);
  const names = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const idx = names.findIndex((n) => n.startsWith(s.slice(0, 3)) && s.length >= 3);
  if (idx >= 0 && !isYmd(s)) {
    const dow = new Date(`${base}T00:00:00Z`).getUTCDay();
    return addDays(base, ((idx - dow + 7) % 7) || 7);
  }
  if (isYmd(s)) return s;
  throw new Error(`can't read "${input}" as a date (use today, tomorrow, backlog, a weekday or YYYY-MM-DD)`);
}

export function minutesLabel(min: number): string {
  if (!min) return '0m';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}
