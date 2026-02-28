import assert from 'assert';

// Sentinel value used for when something is not found
// (since undefined or null might be a legitimate value)
const NOT_FOUND = Symbol('NOT_FOUND');

type MaybePromise<T> = T | PromiseLike<T>;
type Predicate<T> = boolean | ((input: T) => boolean);

export type Pair<T, R> = readonly [predicate: Predicate<T>, action: (input: T) => R];
export type CatchContext<A extends unknown[]> = { error: Error; args: A };

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value == null || typeof value !== 'object') {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

/**
 * Simple dotted-path getter.
 * Missing path segments return `defaultValue`.
 *
 * @example
 * const s = get({ best: { snack: { ever: 'tacos' } } }, 'best.snack.ever', 'mystery-celery');
 * // s === 'tacos'
 */
function get(obj: object, path: string | string[], defaultValue?: unknown): unknown;
function get(obj: unknown, path: string | string[], defaultValue?: unknown): unknown;
function get(obj: unknown, path: string | string[], defaultValue: unknown = undefined): unknown {
  if (obj == null) return defaultValue;
  if (path == null || path === '') return obj;

  const parts = Array.isArray(path) ? path : path.split('.').filter(Boolean);
  let current: unknown = obj;

  // eslint-disable-next-line no-restricted-syntax
  for (const part of parts) {
    if (current == null || typeof current !== 'object') {
      return defaultValue;
    }

    const container = current as Record<string, unknown>;
    if (!(part in container)) {
      return defaultValue;
    }
    current = container[part];
  }

  return current === undefined ? defaultValue : current;
}

/**
 * Evaluates the input: if it's a function, calls it with provided arguments;
 * otherwise returns the input as-is.
 */
const evaluate = <T, A extends unknown[]>(value: T | ((...args: A) => T), ...args: A): T =>
  (typeof value === 'function' ? (value as (...fnArgs: A) => T)(...args) : value);

function coerceToArray<T>(input: T[], opts?: { nullish?: boolean }): T[];
function coerceToArray<T>(input: T | null | undefined, opts?: { nullish?: false }): T[];
function coerceToArray<T>(
  input: T | null | undefined,
  opts: { nullish: true }
): Array<T | null | undefined>;
function coerceToArray<T>(
  input: T[] | T | null | undefined,
  opts: { nullish?: boolean } = { nullish: false }
): Array<T | null | undefined> {
  if (input == null) {
    return opts.nullish ? [input] : [];
  }
  return Array.isArray(input) ? (input as Array<T | null | undefined>) : [input];
}

function ensureArray(obj: unknown, key: string): unknown[] {
  assert.ok(isPlainObject(obj), `obj needs to be a plain object, received ${typeof obj}`);
  const target = obj as Record<string, unknown>;
  const array = coerceToArray(target[key]) as unknown[];
  target[key] = array;
  return array;
}

const pipeAsync =
  <TInput, TOutput = unknown>(
    ...funcs: Array<(input: unknown) => MaybePromise<unknown>>
  ) =>
  async (input: TInput): Promise<TOutput> => {
    let result: unknown = input;
    // eslint-disable-next-line no-restricted-syntax
    for (const fn of funcs) {
      // eslint-disable-next-line no-await-in-loop
      result = await fn(result);
    }
    return result as TOutput;
  };

// Backward compatibility alias. Prefer pipeAsync.
const composeAsync = pipeAsync;

const cond = <T>(input: T, ...pairs: unknown[]): unknown => {
  for (let i = 0; i < pairs.length; i += 2) {
    const predicate = pairs[i] as Predicate<T>;
    const action = pairs[i + 1] as ((value: T) => unknown) | undefined;

    if (typeof action === 'function' && evaluate(predicate, input)) {
      return action(input);
    }
  }
  return input;
};

const toError = (err: unknown): Error => (err instanceof Error ? err : new Error(String(err)));

const tryCatch = <A extends unknown[], T>(
  tryFunc: (...args: A) => T,
  catchFunc: (ctx: CatchContext<A>) => T
) => {
  return (...args: A): T => {
    try {
      return tryFunc(...args);
    } catch (err) {
      return catchFunc({ error: toError(err), args });
    }
  };
};

const tryCatchAsync = <A extends unknown[], T>(
  tryFunc: (...args: A) => MaybePromise<T>,
  catchFunc: (ctx: CatchContext<A>) => MaybePromise<T>
) => {
  return async (...args: A): Promise<Awaited<T>> => {
    try {
      return await tryFunc(...args);
    } catch (err) {
      return await catchFunc({ error: toError(err), args });
    }
  };
};

const findIn = <TNotFound = undefined>(objects: unknown | unknown[], notFound?: TNotFound) => {
  return (field: string | string[]): unknown | TNotFound => {
    for (const obj of coerceToArray(objects) as unknown[]) {
      const value = get(obj, field, NOT_FOUND);
      if (value !== NOT_FOUND) {
        return value;
      }
    }
    return notFound as TNotFound;
  };
};

function getIn(path: string | string[], defaultValue: unknown = undefined) {
  return (objects: unknown | unknown[]): unknown => {
    for (const p of coerceToArray(path) as string[]) {
      for (const obj of coerceToArray(objects) as unknown[]) {
        const value = get(obj, p, NOT_FOUND);
        if (value !== NOT_FOUND) {
          return value;
        }
      }
    }
    return defaultValue;
  };
}

function matchIn<TItem, TCriteria, TNotFound = undefined>(
  collection: TItem | TItem[],
  matchFunc: (item: TItem, criteria: TCriteria) => boolean,
  notFound?: TNotFound
) {
  return (criteria: TCriteria): TItem | TNotFound => {
    const found = (coerceToArray(collection) as TItem[]).find((item) => matchFunc(item, criteria));
    return found === undefined ? (notFound as TNotFound) : found;
  };
}

type TransformerPair = [PropertyKey, unknown];
type TransformResult = TransformerPair | [] | null | undefined;
type TransformerFn = (entry: [string, unknown]) => TransformResult;
type TransformerOpts<TOut> = { as: (pairs: TransformerPair[]) => TOut };

const transformer = <TOut = Record<string, unknown>>(
  fn: TransformerFn = ([k, v]) => [k, v],
  opts: TransformerOpts<TOut> = { as: (pairs) => Object.fromEntries(pairs) as TOut }
) => {
  return (obj: Record<string, unknown>): TOut => {
    const transformed = Object.entries(obj).map((entry) => fn(entry as [string, unknown]));
    const filtered = transformed.filter(
      (pair): pair is TransformerPair => Array.isArray(pair) && pair.length > 0 && Boolean(pair[0])
    );
    return opts.as(filtered);
  };
};

const zip = (...arrays: unknown[][]): unknown[][] => {
  assert.ok(arrays.length > 0, 'you need to pass in at least one array to zip');
  const len = Math.min(...arrays.map((arr) => arr.length));
  const out: unknown[][] = [];
  for (let i = 0; i < len; i += 1) {
    out.push(arrays.map((arr) => arr[i]));
  }
  return out;
};

const zipStrict = (...arrays: unknown[][]): unknown[][] => {
  for (let i = 1; i < arrays.length; i += 1) {
    assert.ok(Array.isArray(arrays[i]));
    assert.equal(
      arrays[i].length,
      arrays[i - 1].length,
      'mismatched length, if this was identional use zip() not zipStrict()'
    );
  }
  return zip(...arrays);
};

const invertObject = transformer<Record<string, string>>(([key, value]) => [String(value), key]);

export {
  NOT_FOUND,
  get,
  evaluate,
  coerceToArray,
  ensureArray,
  pipeAsync,
  composeAsync,
  cond,
  transformer,
  zip,
  zipStrict,
  tryCatch,
  tryCatchAsync,
  findIn,
  getIn,
  matchIn,
  invertObject,
};
