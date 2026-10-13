import { describe, expect, it } from 'vitest';
import { placeAt } from '../lib/order';

describe('placeAt', () => {
  const ids = ['a', 'b', 'c', 'd'];
  it('moves a task up', () => expect(placeAt(ids, 'c', 0)).toEqual(['c', 'a', 'b', 'd']));
  it('moves a task down onto the line before another', () => expect(placeAt(ids, 'a', 2)).toEqual(['b', 'a', 'c', 'd']));
  it('leaves a task in place when dropped just below itself', () => expect(placeAt(ids, 'b', 2)).toEqual(ids));
  it('moves a task to the end', () => expect(placeAt(ids, 'a', 4)).toEqual(['b', 'c', 'd', 'a']));
  it('inserts a new task at the line', () => expect(placeAt(ids, 'x', 1)).toEqual(['a', 'x', 'b', 'c', 'd']));
});
