import { describe, expect, it } from 'vitest';
import { parseMac } from '@/components/mac';

describe('parseMac', () => {
  it('reads what the Mac app sets', () => {
    expect(parseMac({ version: '0.1.2', available: '0.1.3', canCheck: true })).toEqual({ version: '0.1.2', available: '0.1.3', canCheck: true });
    expect(parseMac({ version: '0.1.2', available: null, canCheck: false })).toEqual({ version: '0.1.2', available: null, canCheck: false });
  });

  it('treats anything else as no Mac app', () => {
    for (const v of [undefined, null, 'x', 1, {}, { version: '' }, { version: 2 }]) expect(parseMac(v)).toBeNull();
  });

  it('ignores a malformed update and assumes a check is possible', () => {
    expect(parseMac({ version: '0.1.2', available: 3 })).toEqual({ version: '0.1.2', available: null, canCheck: true });
    expect(parseMac({ version: '0.1.2', available: '' })).toEqual({ version: '0.1.2', available: null, canCheck: true });
  });
});
