const isObjectLike = (value: unknown): value is Record<string, unknown> =>
  value != null && typeof value === 'object';

const setAtPath = (target: Record<string, unknown>, path: string, value: unknown): void => {
  const parts = path.split('.').filter(Boolean);
  if (parts.length === 0) {
    return;
  }

  let current: Record<string, unknown> | unknown[] = target;

  for (let i = 0; i < parts.length; i += 1) {
    const key = parts[i];
    const isLast = i === parts.length - 1;
    const nextKey = parts[i + 1];
    const nextIsIndex = Number.isInteger(Number(nextKey));
    const containerKey: string | number = Number.isInteger(Number(key)) ? Number(key) : key;

    if (isLast) {
      current[containerKey] = value;
      return;
    }

    const existing = current[containerKey];
    if (existing != null && typeof existing === 'object') {
      current = existing as Record<string, unknown> | unknown[];
      continue;
    }

    const nextContainer: Record<string, unknown> | unknown[] = nextIsIndex ? [] : {};
    current[containerKey] = nextContainer;
    current = nextContainer;
  }
};

// We might want to consolidate these, right now it works like this:
// flattenObject():
// * flattens objects
// * leaves arrays unchanged
// * non-objects (null, undefined, primitives) are returned as-is

// flatten()
// * flattens objects
// * allows flattening arrays (lodash-style) which also the default behavior
// * returns an object eg flatten(null) -> {}

// unflatten()
// * made to be compatible with flatten()
// * allows restoring of arrays (lodash-style)

// flattens an object recursively
// typical usage: flattenObject({a: {b: 1, c: {d: 2}}}) returns {'a.b': 1, 'a.c.d': 2}
// note: does NOT flatten arrays
const flattenObject = (obj: unknown, delimiter = '.'): unknown => {
  const flatObj: Record<string, unknown> = {};

  if (Array.isArray(obj)) {
    return obj.map((entry) => flattenObject(entry, delimiter));
  }

  if (!isObjectLike(obj)) {
    return obj;
  }

  Object.entries(obj).forEach(([key, val]) => {
    if (isObjectLike(val) && !Array.isArray(val)) {
      // union the returned result by concat all keys
      const strip = flattenObject(val, delimiter);
      if (isObjectLike(strip) && !Array.isArray(strip)) {
        Object.entries(strip).forEach(([k, v]) => {
          flatObj[`${key}${delimiter}${k}`] = v;
        });
      }
    } else {
      flatObj[key] = val;
    }
  });

  return flatObj;
};

const flatten = (
  obj: unknown,
  options: { delimiter?: string; flattenArrays?: boolean } = {}
): Record<string, unknown> => {
  const { delimiter = '.', flattenArrays = true } = options;

  // Collect all paths and their values
  function collectPaths(o: unknown, currentPath: string[] = []): Array<[string[], unknown]> {
    // Handle null early
    if (o == null) {
      return [[currentPath, null]];
    }

    // Handle primitives
    if (typeof o !== 'object') {
      return [[currentPath, o]];
    }

    // Handle arrays and objects
    return Object.entries(o as Record<string, unknown>).flatMap(([key, value]) => {
      const newPath = [...currentPath, key];

      // For arrays, either flatten or keep intact based on option
      if (Array.isArray(value) && !flattenArrays) {
        return [[newPath, value]];
      }

      // Recurse for objects and arrays (when flattening)
      if (typeof value === 'object' && value != null) {
        return collectPaths(value, newPath);
      }

      return [[newPath, value]];
    });
  }

  // Convert the collected paths to a flat object
  const paths = collectPaths(obj);
  const result: Record<string, unknown> = {};

  paths.forEach(([path, value]) => {
    if (path.length > 0) {
      result[path.join(delimiter)] = value;
    }
  });

  return result;
};

/**
 * Un-flattens an object with delimited keys into a nested structure
 */
const unflatten = (flatObj: Record<string, unknown>): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(flatObj)) {
    setAtPath(result, key, value);
  }
  return result;
};

// predicate function that returns whether an object is a primitive or not
// does *not* consider nullish values a primitive
const isPrimitive = (value: unknown): boolean => Object(value) !== value;

/**
 * Internal helper that merges two objects by concatenating array values.
 * Keys missing in either object are treated as empty arrays.
 */
function _mergeTwoConcat(a: Record<string, unknown[]>, b: Record<string, unknown[]>) {
  const result: Record<string, unknown[]> = {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);

  for (const key of keys) {
    const valA = a[key] ?? [];
    const valB = b[key] ?? [];
    result[key] = valA.concat(valB);
  }

  return result;
}

/**
 * Public API: Merges any number of objects by concatenating array values per key.
 */
function mergeConcat(...objs: Array<Record<string, unknown[]>>) {
  return objs.reduce(_mergeTwoConcat, {});
}

export { flattenObject, flatten, unflatten, isPrimitive, mergeConcat };
