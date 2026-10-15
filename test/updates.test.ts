import { describe, expect, it } from 'vitest';
import { newerDeploy } from '@/components/updates';

describe('newerDeploy', () => {
  it('sees a newer deploy when the live commit differs from the page', () => {
    expect(newerDeploy('a1b2c3', 'd4e5f6')).toBe(true);
  });

  it('stays quiet on the same commit, a dev build, or a bad answer', () => {
    expect(newerDeploy('a1b2c3', 'a1b2c3')).toBe(false);
    expect(newerDeploy('dev', 'd4e5f6')).toBe(false);
    expect(newerDeploy('a1b2c3', 'dev')).toBe(false);
    for (const live of [undefined, null, '', 42, {}]) expect(newerDeploy('a1b2c3', live)).toBe(false);
  });
});
