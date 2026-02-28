import { get } from './funcUtils.js';
import { isPrimitive } from './objUtils.js';

type AnyPredicate = (...args: unknown[]) => boolean;

type HasContainer = { has: (arg: any) => boolean };

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value == null || typeof value !== 'object') {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

/** @namespace Predicate */
const Predicate = {
  /* ──────────── primitives & numeric helpers ──────────── */
  True: (..._args: unknown[]) => true,
  False: (..._args: unknown[]) => false,

  Primitive: () => (v: unknown) => isPrimitive(v),

  Number: () => (v: unknown) => typeof v === 'number' && Number.isFinite(v),

  Integer: () => (v: unknown) => typeof v === 'number' && Number.isInteger(v),

  Min: (min: number, inclusive = true) => (v: unknown) =>
    typeof v === 'number' && (inclusive ? v >= min : v > min),

  Max: (max: number, inclusive = true) => (v: unknown) =>
    typeof v === 'number' && (inclusive ? v <= max : v < max),

  Equal: (expected: unknown) => (v: unknown) => v === expected,

  /* ────────────  membership helpers ──────────── */

  // Set / Map membership: `Has(mySet)(x)` → `mySet.has(x)`.
  Has: (container: HasContainer) => (v: unknown) => container.has(v),

  // Property-existence: `In('foo')(obj)` ⇢ `'foo' in obj`.
  In: (key: string | symbol) => (v: unknown) => v != null && key in Object(v),

  // TODO: Kind of ugly but sometimes we really just can't filter on the path but must check
  // TODO: the node itself, that's the second parameter that's rarely used
  InNode: (key: string | symbol) => (_path: unknown, node: unknown) =>
    node != null && key in Object(node),

  /* ──────────── string atoms ──────────── */

  AnyString: () => (v: unknown) => typeof v === 'string',
  String: (s: string) => (v: unknown) => typeof v === 'string' && v === s,
  StartsWith: (prefix: string) => (v: unknown) => typeof v === 'string' && v.startsWith(prefix),
  EndsWith: (suffix: string) => (v: unknown) => typeof v === 'string' && v.endsWith(suffix),
  Includes: (frag: string) => (v: unknown) => typeof v === 'string' && v.includes(frag),
  Matches: (re: RegExp) => (v: unknown) => typeof v === 'string' && re.test(v),

  /* ──────────── boolean combinators ──────────── */

  And:
    (...preds: AnyPredicate[]) =>
    (...args: unknown[]) =>
      preds.every((p) => p(...args)),

  Or:
    (...preds: AnyPredicate[]) =>
    (...args: unknown[]) =>
      preds.some((p) => p(...args)),

  Not:
    (pred: AnyPredicate) =>
    (...args: unknown[]) =>
      !pred(...args),

  /* ──────────── array helpers ──────────── */

  // Array tail pattern: predicates for last N items (left➜right order).
  ArrayEndsWith: (...tailPreds: Array<(value: unknown) => boolean>) => (arr: unknown) => {
    if (!Array.isArray(arr) || arr.length < tailPreds.length) {
      return false;
    }

    const parts = arr.slice(-tailPreds.length);
    for (let i = 0; i < tailPreds.length; i += 1) {
      if (!tailPreds[i](parts[i])) {
        return false;
      }
    }

    return true;
  },

  // TODO: Maybe remove? Abusable :D
  /* Truthy / Falsy guards */
  Truthy: () => (v: unknown) => Boolean(v),
  Falsy: () => (v: unknown) => !v,

  /** Defined – eliminates `null` and `undefined` */
  Defined: () => (v: unknown) => v != null,

  // One-of enumeration: `OneOf('red','green')(v)`
  OneOf: (...allowed: unknown[]) => {
    const set = new Set([...allowed]);
    return (v: unknown) => set.has(v);
  },

  FieldIsOneOf: (field: string, ...allowed: unknown[]) => {
    const oneOf = Predicate.OneOf(...allowed);
    return (_path: unknown, node: unknown) => {
      if (!isPlainObject(node)) {
        return false;
      }
      return oneOf(get(node, field));
    };
  },

  // Length constraint for any `.length`-bearing value (string/array/typed-array…).
  Length: (min: number, max = min) =>
    (v: unknown) =>
      typeof (v as { length?: unknown })?.length === 'number' &&
      (v as { length: number }).length >= min &&
      (v as { length: number }).length <= max,
};

/* ──────────── helpers ──────────── */

const satisfies = (predicate: (value: unknown) => boolean, value: unknown): boolean => predicate(value);

const satisfiesAll =
  (...preds: Array<(value: unknown) => boolean>) =>
  (...vals: unknown[]): boolean =>
    preds.length === vals.length && preds.every((p, i) => p(vals[i]));

export { Predicate, satisfies, satisfiesAll };
