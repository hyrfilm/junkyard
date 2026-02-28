import assert from 'assert';
import { Predicate } from './predicates.js';
import { isPrimitive } from './objUtils.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Path = (string | number)[];
export type VisitorFn = (args: { node: unknown; path: Path }) => void;
export type Criteria = (path: Path, node: unknown) => boolean;
export type TreeCommand = { what: VisitorFn; where: Criteria };
export type CollectCommand = {
  what: (args: { path: Path; node: unknown }) => unknown;
  where: (path: Path, node: unknown) => boolean;
};
export type TraverserHandler = (args: {
  node: unknown;
  path: Path;
  field: string;
  value: unknown;
}) => void;

// ─── Error messages ───────────────────────────────────────────────────────────

const ErrorMessages = {
  NO_ROOT: 'root-parameter: received nullish value - not allowed',
  NO_VISITOR: 'visit-parameter: no visitor provided',
  INVALID_VISITOR: 'visit-parameter: must be a function',
} as const;

// ─── walkTree ─────────────────────────────────────────────────────────────────

const walkTree = (
  root: unknown,
  visitor: VisitorFn,
  criteria: Criteria = Predicate.True
): unknown => {
  assert.ok(root != null, ErrorMessages.NO_ROOT);
  assert.ok(visitor != null, ErrorMessages.NO_VISITOR);
  assert.ok(typeof visitor === 'function', ErrorMessages.INVALID_VISITOR);

  const visitNode = (node: unknown, path: Path): void => {
    if (criteria(path, node)) {
      visitor({ node, path });
    }

    if (Array.isArray(node)) {
      node.forEach((item, idx) => visitNode(item, [...path, idx]));
    } else if (node && typeof node === 'object') {
      Object.entries(node as Record<string, unknown>).forEach(([k, v]) =>
        visitNode(v, [...path, k])
      );
    }
  };

  visitNode(root, []);
  return root;
};

// ─── transformTree ────────────────────────────────────────────────────────────

const transformTree = (root: unknown, ...commands: TreeCommand[]): unknown => {
  let current = root;
  for (const { what, where } of commands) {
    assert.ok(what);
    assert.ok(where);
    current = walkTree(structuredClone(current), what, where);
  }
  return current;
};

// ─── Visitor ──────────────────────────────────────────────────────────────────

// Takes a node and does something to it
const Visitor = {
  addField:
    (field: string, valueFunc: (node: unknown) => unknown) =>
    ({ node }: { node: unknown }) =>
      Object.assign(node as object, { [field]: valueFunc(node) }),
};

// ─── Command ──────────────────────────────────────────────────────────────────

// Composite of a criteria (where) and a visitor (what)
const Command = {
  create: (command: Partial<TreeCommand> = {}): TreeCommand => {
    const { what = () => {}, where = () => true } = command;
    assert.ok(typeof what === 'function');
    assert.ok(typeof where === 'function');
    return { what, where };
  },
};

// ─── collectWhere ─────────────────────────────────────────────────────────────

// Collect primitive: traverse and collect values
// where is a predicate that indicates if to collect,
// if true what is called and expects to return what to collect
const collectWhere = (root: unknown, command: CollectCommand): unknown[] => {
  const { what, where } = command;
  assert.ok(root);
  assert.ok(command);
  assert.ok(what);
  assert.ok(where);

  const collected: unknown[] = [];

  walkTree(root, ({ node, path }) => {
    if (where(path, node)) {
      const result = what({ path, node });
      collected.push(result);
    }
  });
  return collected;
};

// ─── createTraverser ──────────────────────────────────────────────────────────

const createTraverser = (opts = { visitOnce: true }) => {
  const predicates = new Map<string, TraverserHandler>();
  const visited = new Set<string>();
  return {
    onField: (field: string, handler: TraverserHandler) => {
      const key = JSON.stringify(field);
      if (!visited.has(key)) {
        predicates.set(field, handler);
        if (opts.visitOnce) {
          visited.add(key);
        }
      }
    },
    traverse: (root: unknown) => {
      walkTree(root, ({ node, path }) => {
        if (node && typeof node === 'object') {
          for (const [field, handler] of predicates) {
            if (Object.hasOwn(node as object, field)) {
              const value = (node as Record<string, unknown>)[field];
              handler({ node, path, field, value });
            }
          }
        }
      });
    },
  };
};

// ─── createIdCollector ────────────────────────────────────────────────────────

const createIdCollector = (field: string) => {
  const fields = new Set<unknown>();
  const command: CollectCommand = {
    what: ({ node }) => fields.add((node as Record<string, unknown>)[field]),
    where: (_, node) => {
      // intentional nullish coercion
      if (node == null) return false;
      if (isPrimitive(node)) return false;
      return field in (node as object);
    },
  };
  return (obj: unknown) => {
    collectWhere(obj, command);
    return Array.from(fields);
  };
};

// ─── foldTree ─────────────────────────────────────────────────────────────────

// Post-order tree fold (catamorphism). Recursively folds a tree from leaves
// upward, passing each node's already-folded children to the folder function.
const foldTree = <T>(
  root: unknown,
  folder: (args: { node: unknown; children: T[] }) => T | null | undefined,
  getChildren: (node: unknown) => unknown[]
): T | null | undefined => {
  assert.ok(root != null, ErrorMessages.NO_ROOT);
  assert.ok(folder != null, 'folder-parameter: no folder provided');
  assert.ok(typeof folder === 'function', 'folder-parameter: must be a function');
  assert.ok(typeof getChildren === 'function', 'getChildren-parameter: must be a function');

  const foldNode = (node: unknown): T | null | undefined => {
    const children = getChildren(node)
      .map(foldNode)
      .filter((v): v is T => v != null);
    return folder({ node, children });
  };

  return foldNode(root);
};

export {
  walkTree,
  transformTree,
  createTraverser,
  collectWhere,
  createIdCollector,
  foldTree,
  Visitor,
  Command,
};
