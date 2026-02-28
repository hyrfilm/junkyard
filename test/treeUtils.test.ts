import { describe, expect, test } from 'vitest';
import { flatten, unflatten, isPrimitive } from '$utils/objUtils.js';
import { walkTree, foldTree } from '$utils/treeUtils.js';
import { cond } from '$utils/funcUtils.js';
import { Predicate } from '$utils/predicates.js';

describe('walkTree', () => {
  test('throws error when root is null', () => {
    expect(() => walkTree(null, () => {})).toThrow(/root/);
  });

  test('throws error when visitor is null', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => walkTree({}, null as any)).toThrow(/visit/);
  });

  test('throws error when visitor is not a function', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => walkTree({}, {} as any)).toThrow(/function/);
  });

  test('walks a nested object structure', () => {
    const root = { a: { b: 2 }, c: [3, { d: 4 }] };
    const visitedPaths: string[] = [];
    walkTree(root, ({ path }) => visitedPaths.push(path.join('.')));
    // Just a simple check that the paths were visited
    expect(visitedPaths).toContain('a'); // visited object 'a'
    expect(visitedPaths).toContain('a.b'); // visited value 2
    expect(visitedPaths).toContain('c.0'); // visited value 3
    expect(visitedPaths).toContain('c.1.d'); // visited value 4
    flatten(visitedPaths.flat(-1));
  });

  test('Uses an array as root', () => {
    const paths: unknown[][] = [];
    const leaves: unknown[] = [];
    const root = [1, { x: 2 }, [3, 4], { y: { z: ['5', 6.66] } }];
    walkTree(root, ({ path }) => paths.push(path));
    walkTree(root, ({ node }) => (isPrimitive(node) ? leaves.push(node) : leaves));

    expect(leaves).toEqual([1, 2, 3, 4, '5', 6.66]);

    expect(paths).toEqual([
      [],
      [0],
      [1],
      [1, 'x'],
      [2],
      [2, 0],
      [2, 1],
      [3],
      [3, 'y'],
      [3, 'y', 'z'],
      [3, 'y', 'z', 0],
      [3, 'y', 'z', 1],
    ]);
  });

  test('walks the tree and reconstructs the original structure using unflatten', () => {
    const root = {
      a: { b: [1, 2, 'dude'], c: [{ where: 'is' }, { my: 'car' }] },
      e: 42,
      f: [{ g: true }, 'x'],
    };

    const pathMap: Record<string, unknown> = {};
    walkTree(root, ({ node, path }) => {
      // Convert path array to a delimited string (e.g. 'a.c.d')
      const pathString = path.join('.');
      if (pathString) {
        pathMap[pathString] = node;
      }
    });

    const reconstructed = unflatten(pathMap);
    expect(reconstructed).toEqual(root);
  });

  test('walks the tree adds a new field for each node', () => {
    const root = [{ a: {} }, { b: {} }, { c: {} }];
    let counter = 0;
    const visitor1 = ({ node, path }: { node: unknown; path: unknown[] }) =>
      cond(path, Predicate.ArrayEndsWith(Predicate.OneOf(0, 1, 2)), () => {
        Object.assign(node as object, { id: counter });
        counter += 1;
      });

    const visitor2 = ({ node, path }: { node: unknown; path: unknown[] }) =>
      cond(path, Predicate.ArrayEndsWith(Predicate.OneOf('a', 'b', 'c')), () => {
        const key = path.slice(-1)[0];
        Object.assign(node as object, { innerId: (key as string).toUpperCase() });
        counter += 1;
      });

    walkTree(root, visitor1);
    walkTree(root, visitor2);
    expect(flatten(root)).toEqual({
      '0.a.innerId': 'A',
      '0.id': 0,
      '1.b.innerId': 'B',
      '1.id': 1,
      '2.c.innerId': 'C',
      '2.id': 2,
    });
  });
});

// ─── foldTree ─────────────────────────────────────────────────────────────────

const getContent = (node: unknown): unknown[] => {
  const content = (node as Record<string, unknown>)?.content;
  return Array.isArray(content) ? content : [];
};

describe('foldTree', () => {
  test('throws when root is null', () => {
    expect(() => foldTree(null, () => null, () => [])).toThrow(/root/);
  });

  test('throws when folder is not a function', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => foldTree({}, null as any, () => [])).toThrow(/folder/);
  });

  test('throws when getChildren is not a function', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => foldTree({}, () => null, null as any)).toThrow(/getChildren/);
  });

  test('folds a leaf node with no children', () => {
    const node = { nodeType: 'text', value: 'hello', content: [] };
    const result = foldTree(node, ({ node: n }) => (n as typeof node).value, getContent);
    expect(result).toBe('hello');
  });

  test('folds children before the parent (post-order)', () => {
    const order: string[] = [];
    const tree = {
      id: 'root',
      content: [
        { id: 'a', content: [] },
        { id: 'b', content: [] },
      ],
    };
    foldTree(
      tree,
      ({ node: n }) => { order.push((n as typeof tree).id); return (n as typeof tree).id; },
      getContent
    );
    expect(order).toEqual(['a', 'b', 'root']);
  });

  test('passes already-folded children to the folder', () => {
    const tree = {
      nodeType: 'paragraph',
      content: [
        { nodeType: 'text', value: 'Hello ', content: [] },
        { nodeType: 'text', value: 'world', content: [] },
      ],
    };
    const result = foldTree<string>(
      tree,
      ({ node: n, children }) => {
        const typed = n as { nodeType: string; value?: string };
        if (typed.nodeType === 'text') return typed.value ?? '';
        return children.join('');
      },
      getContent
    );
    expect(result).toBe('Hello world');
  });

  test('filters null returns from children before passing them up', () => {
    const tree = {
      nodeType: 'document',
      content: [
        { nodeType: 'keep', content: [] },
        { nodeType: 'drop', content: [] },
        { nodeType: 'keep', content: [] },
      ],
    };
    const result = foldTree<string>(
      tree,
      ({ node: n, children }) => {
        const typed = n as { nodeType: string };
        if (typed.nodeType === 'drop') return null;
        if (typed.nodeType === 'keep') return 'kept';
        return children.join(',');
      },
      getContent
    );
    expect(result).toBe('kept,kept');
  });
});
