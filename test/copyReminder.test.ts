import { describe, expect, it } from 'vitest';
import { COPY_EVERY, copyReminder } from '@/lib/copyReminder';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 9, 15, 12);
const ago = (days: number) => now - days * DAY;

describe('asking for a copy on this device', () => {
  it('waits a week after starting before the first copy', () => {
    expect(copyReminder({ copiedAt: null, since: ago(3), later: null }, now)).toEqual({ due: false, days: null });
    expect(copyReminder({ copiedAt: null, since: ago(8), later: null }, now)).toEqual({ due: true, days: null });
  });

  it('asks again a week after the last copy, and says how long ago it was', () => {
    expect(copyReminder({ copiedAt: ago(3), since: ago(40), later: null }, now)).toEqual({ due: false, days: 3 });
    expect(copyReminder({ copiedAt: ago(9), since: ago(40), later: null }, now)).toEqual({ due: true, days: 9 });
    expect(copyReminder({ copiedAt: now - COPY_EVERY, since: null, later: null }, now).due).toBe(true);
  });

  it('keeps quiet while it was put off', () => {
    expect(copyReminder({ copiedAt: ago(9), since: null, later: now + DAY }, now).due).toBe(false);
    expect(copyReminder({ copiedAt: ago(9), since: null, later: now - 1 }, now).due).toBe(true);
  });

  it('never asks with nothing to go on', () => {
    expect(copyReminder({ copiedAt: null, since: null, later: null }, now).due).toBe(false);
  });
});
