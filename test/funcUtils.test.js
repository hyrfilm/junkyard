import { describe, expect, it, test, vitest } from 'vitest';

import {
	coerceToArray,
	ensureArray,
	composeAsync,
	cond,
	tryCatch,
	tryCatchAsync,
	findIn,
	getIn,
	matchIn,
} from '$utils/funcUtils.js'

const isError = (value) => value instanceof Error;
const isString = (value) => typeof value === 'string';

describe('coerceToArray', () => {
	it('should return array as-is when input is already an array', () => {
		const input = [1, 2, 3];
		const result = coerceToArray(input);
		expect(result).toEqual([1, 2, 3]);
		expect(result).toBe(input); // same reference
	});

	it('should wrap non-array values in an array', () => {
		expect(coerceToArray(1)).toEqual([1]);
		expect(coerceToArray('hello')).toEqual(['hello']);
		expect(coerceToArray(true)).toEqual([true]);
		expect(coerceToArray({ key: 'value' })).toEqual([{ key: 'value' }]);
	});

	it('should return empty array for nullish values by default', () => {
		expect(coerceToArray(null)).toEqual([]);
		expect(coerceToArray(undefined)).toEqual([]);
	});

	it('should wrap nullish values when nullish option is true', () => {
		expect(coerceToArray(null, { nullish: true })).toEqual([null]);
		expect(coerceToArray(undefined, { nullish: true })).toEqual([undefined]);
	});
});

describe('ensureArray', () => {
	it('should create empty array for non-existent key', () => {
		const obj = {};
		const result = ensureArray(obj, 'items');
		expect(result).toEqual([]);
		expect(obj.items).toEqual([]);
	});

	it('should return existing array unchanged', () => {
		const obj = { items: [1, 2, 3] };
		const result = ensureArray(obj, 'items');
		expect(result).toEqual([1, 2, 3]);
		expect(result).toBe(obj.items); // same reference
	});

	it('should wrap non-array values in an array', () => {
		const obj = { count: 5 };
		const result = ensureArray(obj, 'count');
		expect(result).toEqual([5]);
		expect(obj.count).toEqual([5]);
	});

	it('should create empty array for nullish values', () => {
		const obj = { value: null, other: undefined };
		expect(ensureArray(obj, 'value')).toEqual([]);
		expect(ensureArray(obj, 'other')).toEqual([]);
		expect(obj.value).toEqual([]);
		expect(obj.other).toEqual([]);
	});

	it('should only accept objects', () => {
		expect(() => ensureArray(123, 'value')).toThrow();
		expect(() => ensureArray([], 'other')).toThrow();
	});
});

describe('composeAsync', () => {
	it('should compose multiple functions into a single async function', async () => {
		const fetchUser = async (id) => ({ id, name: 'Leanne Graham' });
		const fetchPosts = async (user) => ({ ...user, posts: [{ id: 1, title: 'Post 1' }] });
		const addTimestamp = (data) => ({ ...data, fetchedAt: new Date().toISOString() });
		const fetcher = composeAsync(fetchUser, fetchPosts, addTimestamp);

		const result = await fetcher(1);
		expect(result).toMatchObject({
			id: 1,
			name: 'Leanne Graham',
			posts: [{ id: 1, title: 'Post 1' }],
			fetchedAt: expect.any(String)
		});
	});

	it('should handle an empty list of functions', async () => {
		const composedAsync = composeAsync();

		const result = await composedAsync(42);
		expect(result).toBe(42); // No functions applied, should return the input
	});

	it('should escalate exceptions', async () => {
		const func1 = async (value) => {
			if (value !== 42) {
				throw Error('Expected');
			}
			return value;
		};
		const func2 = async (value) => value;
		const composedAsync = composeAsync(func1, func2);

		// Passing in a 42 should just ripple through and come out the other side
		const result = await composedAsync(42);
		expect(result).toBe(42); // If nothing throws we should just get back 42

		// Passing in anything else will cause the first function to throw an exception
		try {
			await composedAsync(1234);
			throw new Error('Should not reach here');
		} catch (e) {
			expect(e.message).toBe('Expected');
		}
	});

	it('should handle promises', async () => {
		const promiseKeeper = new Promise((resolve) => {
			resolve('resolved');
		});
		const promiseBreaker = new Promise((_resolve, reject) => {
			reject('rejected');
		});

		let composedFunc = composeAsync(() => promiseKeeper);
		expect(await composedFunc()).toBe('resolved');

		composedFunc = composeAsync(() => promiseBreaker);
		await expect(composedFunc).rejects.toBe('rejected');
	});

	it('goes especially well with tryCatch', async () => {
		async function messyLegacyFunction(input) {
			const someComplexThing = (someNumber) => {
				if (someNumber === 42) {
					return 42;
				}
				if (someNumber < 42) {
					return 'too small';
				}
				if (someNumber > 42) {
					return 'too big';
				}
				throw new Error('not a number');
			};

			return new Promise((resolve) => {
				resolve(someComplexThing(input));
			});
		}

		const handleResult = (input) =>
			cond(
				input,
				// if an exception was thrown return its message
				() => isError(input) && input?.message,
				() => input.message,
				// if we got a string return it
				() => isString(input),
				() => input,
				// if we got 42 return a custom string
				() => input === 42,
				() => 'just right',
				// default case
				() => true,
				() => 'should not happen'
			);
		const catcher = ({ error }) => error;

		const prettyFunction = composeAsync(tryCatchAsync(messyLegacyFunction, catcher), handleResult);
		expect(await prettyFunction(41)).toBe('too small');
		expect(await prettyFunction(43)).toBe('too big');
		expect(await prettyFunction(42)).toBe('just right');
		expect(await prettyFunction('dude')).toBe('not a number');
	});
});

describe('cond for HTTP status code handling', () => {
	it('should return the correct message based on HTTP status code', () => {
		// Define predicates for HTTP status codes
		const isSuccess = (code) => code >= 200 && code < 300;
		const isClientError = (code) => code >= 400 && code < 500;
		const isServerError = (code) => code >= 500 && code < 600;

		// Define actions based on the predicates
		const successMessage = () => 'Request succeeded!';
		const clientErrorMessage = () => 'Client error occurred.';
		const serverErrorMessage = () => 'Server error occurred.';
		const unknownStatusMessage = () => 'Unknown status code.';

		const handleStatusCode = (code) =>
			cond(
				code,
				isSuccess,
				successMessage,
				isClientError,
				clientErrorMessage,
				isServerError,
				serverErrorMessage,
				true,
				unknownStatusMessage // Default case
			);

		// Test cases for various HTTP status codes
		expect(handleStatusCode(200)).toBe('Request succeeded!');
		expect(handleStatusCode(404)).toBe('Client error occurred.');
		expect(handleStatusCode(500)).toBe('Server error occurred.');
		expect(handleStatusCode(123)).toBe('Unknown status code.');
	});
});

describe('tryCatch', () => {
	it('should return a function that executes tryFunc and returns its result if no error is thrown', () => {
		const tryFunc = () => ({ success: true });
		const catchFunc = () => ({ success: false });
		const safeFunc = tryCatch(tryFunc, catchFunc);
		const result = safeFunc();
		expect(result).toEqual({ success: true });
	});

	it('should return a function that executes catchFunc if tryFunc throws an error', () => {
		const tryFunc = () => {
			throw new Error('Oups');
		};
		const catchFunc = ({ error }) => ({ error: error.message });
		const safeFunc = tryCatch(tryFunc, catchFunc);
		const result = safeFunc();
		expect(result).toEqual({ error: 'Oups' });
	});
});

describe('tryCatchAsync', () => {
	test('returns the URL when tryFunc succeeds', async () => {
		const tryFunc = vitest.fn().mockResolvedValue('https://someurl.com');
		const catchFunc = vitest.fn().mockResolvedValue('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

		const safeFunc = tryCatchAsync(tryFunc, catchFunc);
		const result = await safeFunc();

		expect(result).toBe('https://someurl.com');
		expect(tryFunc).toHaveBeenCalledTimes(1);
		expect(catchFunc).not.toHaveBeenCalled();
	});

	test('returns the Rickroll URL when tryFunc fails', async () => {
		const tryFunc = vitest.fn().mockRejectedValue(new Error('URL not found'));
		const catchFunc = vitest
			.fn()
			.mockImplementation(async ({ error }) =>
				error ? 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' : 'nope'
			);

		const safeFunc = tryCatchAsync(tryFunc, catchFunc);
		const result = await safeFunc();

		expect(result).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
		expect(tryFunc).toHaveBeenCalledTimes(1);
		expect(catchFunc).toHaveBeenCalledTimes(1);
	});
});

describe('findIn', () => {
	const objects = [{ a: { b: 1 }, c: 2 }, { a: { b: 3 }, d: 4 }, { e: 5 }];

	it('should find a field in the first object that contains it', () => {
		const findInObjects = findIn(objects, 'default');

		expect(findInObjects('a.b')).toBe(1); // Found in the first object
		expect(findInObjects(['a', 'b'])).toBe(1); // Array format supported as well
		expect(findInObjects('d')).toBe(4); // Found in the second object
		expect(findInObjects('e')).toBe(5); // Found in the third object
	});

	it('should return the default value if the field is not found', () => {
		const findInObjects = findIn(objects, 'default');

		expect(findInObjects('f.g')).toBe('default'); // Not found in any object
	});

	it('should return undefined if no default value is provided and the field is not found', () => {
		const findInObjects = findIn(objects);

		expect(findInObjects('f.g')).toBeUndefined(); // Not found in any object
	});

	it('should work with configuration and overrides', () => {
		const config = {
			debug: false,
			logLevel: 'info',
			features: { darkMode: false }
		};

		const overrides = {
			features: { darkMode: true },
			provider: 'aws'
		};

		const getConfig = findIn([overrides, config], null);

		expect(getConfig('features.darkMode')).toBe(true); // From overrides
		expect(getConfig('logLevel')).toBe('info'); // From config
		expect(getConfig('provider')).toBe('aws'); // From overrides
		expect(getConfig('nonexistent')).toBeNull(); // Not found anywhere
	});
});

describe('getIn', () => {
	it('should retrieve a value with a single path', () => {
		const getTags = getIn('tags', []);
		const objectA = {};
		const objectB = { tags: [1, 2, 3] };
		const objectC = { tags: undefined };

		expect(getTags(objectA)).toEqual([]);
		expect(getTags(objectB)).toEqual([1, 2, 3]);
		expect(getTags(objectC)).toEqual([]);
	});

	it('should retrieve a value from multiple objects', () => {
		const getTags = getIn('tags', []);
		const objects = [
			{ id: 1 },
			{ id: 2, tags: ['important', 'urgent'] },
			{ id: 3, tags: ['archived'] }
		];

		expect(getTags(objects)).toEqual(['important', 'urgent']);
	});

	it('should search multiple possible paths in order of preference', () => {
		const getTimestamp = getIn(['lastLoginAt', 'createdAt'], 'unknown');

		const newUser = {
			id: 1,
			name: 'John',
			createdAt: '2023-01-01'
		};

		const activeUser = {
			id: 2,
			name: 'Jane',
			createdAt: '2023-01-15',
			lastLoginAt: '2023-05-20'
		};

		const emptyUser = { id: 3 };

		expect(getTimestamp(newUser)).toBe('2023-01-01'); // Falls back to createdAt
		expect(getTimestamp(activeUser)).toBe('2023-05-20'); // Prefers lastLoginAt
		expect(getTimestamp(emptyUser)).toBe('unknown'); // No matching fields
	});
});

describe('matchIn', () => {
	it('should match items using matchIn', () => {
		const items = [
			{ name: 'X', tags: ['Alpha'] },
			{ name: 'Y', tags: ['Beta'] }
		];

		const matchFunc = (item, criteria) =>
			item.tags.some((tag) => tag.toLowerCase().includes(criteria.toLowerCase()));

		const matcher = matchIn(items, matchFunc, items[0]);

		// empty string matches anything so the first element will be returned
		expect(matcher('')).toBe(items[0]);
		expect(matcher('alpha')).toBe(items[0]);
		expect(matcher('beta')).toBe(items[1]);
	});

	it('should find a user by partial name match', () => {
		const users = [
			{ id: 1, name: 'John Smith', role: 'admin' },
			{ id: 2, name: 'Jane Doe', role: 'user' },
			{ id: 3, name: 'Bob Johnson', role: 'editor' }
		];

		const findUserByName = matchIn(
			users,
			(user, searchName) => user.name.toLowerCase().includes(searchName.toLowerCase()),
			{ id: 0, name: 'Not Found', role: 'guest' }
		);

		expect(findUserByName('john')).toEqual(users[0]);
		expect(findUserByName('doe')).toEqual(users[1]);
		expect(findUserByName('unknown')).toEqual({ id: 0, name: 'Not Found', role: 'guest' });
	});
});
