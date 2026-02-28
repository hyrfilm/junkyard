import { describe, expect, test } from 'vitest';
import { flattenObject } from '$utils/objUtils.js';

describe('flattenObject test', () => {
  test('flattenObject - typical usage', () => {
    expect(flattenObject({ a: { b: 1, c: { d: 2 } } })).toEqual({ 'a.b': 1, 'a.c.d': 2 });
    const actual = flattenObject({ a: { b: 1, c: 2, d: { e: 3, f: [1, 2, 3] } } });
    expect(actual).toEqual({ 'a.b': 1, 'a.c': 2, 'a.d.e': 3, 'a.d.f': [1, 2, 3] });
  });

  test('flattenObject - custom delimiter', () => {
    const nested = { a: { b: { c: 1 } } };
    expect(flattenObject(nested, '_')).toEqual({ a_b_c: 1 });
  });

  test('flattenObject - edge cases', () => {
    expect(flattenObject({})).toEqual({});
    expect(flattenObject([])).toEqual([]);
    expect(flattenObject(null)).toEqual(null);
    expect(flattenObject(undefined)).toEqual(undefined);
    expect(flattenObject([1, 2, 3])).toEqual([1, 2, 3]);
  });
});
