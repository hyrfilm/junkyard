import { describe, expect, test } from 'vitest';
import { Predicate, satisfies, satisfiesAll } from '$utils/predicates.js';

describe('Predicate Module', () => {
  describe('Numeric Predicates', () => {
    describe('Number', () => {
      const isNumber = Predicate.Number();

      test('accepts finite numbers', () => {
        expect(isNumber(42)).toBe(true);
        expect(isNumber(0)).toBe(true);
        expect(isNumber(-3.14)).toBe(true);
        expect(isNumber(Number.MAX_SAFE_INTEGER)).toBe(true);
      });

      test('rejects non-numbers and non-finite values', () => {
        expect(isNumber('42')).toBe(false);
        expect(isNumber(NaN)).toBe(false);
        expect(isNumber(Infinity)).toBe(false);
        expect(isNumber(-Infinity)).toBe(false);
        expect(isNumber(null)).toBe(false);
        expect(isNumber(undefined)).toBe(false);
        expect(isNumber({})).toBe(false);
      });
    });

    describe('Integer', () => {
      const isInteger = Predicate.Integer();

      test('accepts integers', () => {
        expect(isInteger(42)).toBe(true);
        expect(isInteger(0)).toBe(true);
        expect(isInteger(-17)).toBe(true);
      });

      test('rejects floats and non-numbers', () => {
        expect(isInteger(3.14)).toBe(false);
        expect(isInteger(0.1)).toBe(false);
        expect(isInteger('42')).toBe(false);
        expect(isInteger(NaN)).toBe(false);
      });
    });

    describe('Min', () => {
      test('inclusive by default', () => {
        const gte5 = Predicate.Min(5);
        expect(gte5(5)).toBe(true);
        expect(gte5(6)).toBe(true);
        expect(gte5(4)).toBe(false);
      });

      test('exclusive when specified', () => {
        const gt5 = Predicate.Min(5, false);
        expect(gt5(5)).toBe(false);
        expect(gt5(6)).toBe(true);
        expect(gt5(4)).toBe(false);
      });
    });

    describe('Max', () => {
      test('inclusive by default', () => {
        const lte10 = Predicate.Max(10);
        expect(lte10(10)).toBe(true);
        expect(lte10(9)).toBe(true);
        expect(lte10(11)).toBe(false);
      });

      test('exclusive when specified', () => {
        const lt10 = Predicate.Max(10, false);
        expect(lt10(10)).toBe(false);
        expect(lt10(9)).toBe(true);
        expect(lt10(11)).toBe(false);
      });
    });

    describe('Equal', () => {
      const is42 = Predicate.Equal(42);

      test('strict equality', () => {
        expect(is42(42)).toBe(true);
        expect(is42('42')).toBe(false);
        expect(is42(41)).toBe(false);
      });

      test('works with different types', () => {
        const isNull = Predicate.Equal(null);
        expect(isNull(null)).toBe(true);
        expect(isNull(undefined)).toBe(false);

        const isEmpty = Predicate.Equal('');
        expect(isEmpty('')).toBe(true);
        expect(isEmpty(' ')).toBe(false);
      });
    });
  });

  describe('Membership Predicates', () => {
    describe('Has', () => {
      test('works with Set', () => {
        const colors = new Set(['red', 'green', 'blue']);
        const hasColor = Predicate.Has(colors);

        expect(hasColor('red')).toBe(true);
        expect(hasColor('yellow')).toBe(false);
      });

      test('works with Map', () => {
        const config = new Map([
          ['debug', true],
          ['port', 3000],
        ]);
        const hasConfig = Predicate.Has(config);

        expect(hasConfig('debug')).toBe(true);
        expect(hasConfig('host')).toBe(false);
      });

      test('works with custom has method', () => {
        const customContainer = {
          data: ['a', 'b', 'c'],
          has(item) {
            return this.data.includes(item);
          },
        };
        const hasItem = Predicate.Has(customContainer);

        expect(hasItem('b')).toBe(true);
        expect(hasItem('d')).toBe(false);
      });
    });

    describe('In', () => {
      test('checks property existence', () => {
        const hasColor = Predicate.In('color');

        expect(hasColor({ color: 'red', size: 'large' })).toBe(true);
        expect(hasColor({ size: 'small' })).toBe(false);
        expect(hasColor({ color: undefined })).toBe(true); // property exists but undefined
      });

      test('works with symbols', () => {
        const sym = Symbol('test');
        const hasSymbol = Predicate.In(sym);
        const obj = { [sym]: 'value' };

        expect(hasSymbol(obj)).toBe(true);
        expect(hasSymbol({})).toBe(false);
      });

      test('handles non-objects gracefully', () => {
        const hasProp = Predicate.In('toString');
        expect(hasProp('hello')).toBe(true); // strings have toString
        expect(hasProp(42)).toBe(true); // numbers have toString
        expect(hasProp(null)).toBe(false);
        expect(hasProp(undefined)).toBe(false);
      });
    });
  });

  describe('String Predicates', () => {
    describe('AnyString', () => {
      const isAnyString = Predicate.AnyString();

      test('accepts strings', () => {
        expect(isAnyString('yo')).toBe(true);
        expect(isAnyString('')).toBe(true);
        expect(isAnyString('123')).toBe(true);
      });

      test('rejects non-strings', () => {
        expect(isAnyString(123)).toBe(false);
        expect(isAnyString(null)).toBe(false);
        expect(isAnyString(undefined)).toBe(false);
        expect(isAnyString([])).toBe(false);
      });
    });

    describe('String with specific value', () => {
      const isFidelio = Predicate.String('fidelio');

      test('matches only "fidelio"', () => {
        expect(isFidelio('fidelio')).toBe(true);
        expect(isFidelio('Fidelio')).toBe(false);
        expect(isFidelio('')).toBe(false);
        expect(isFidelio(null)).toBe(false);
      });
    });

    describe('StartsWith', () => {
      const startsWithHttp = Predicate.StartsWith('http');

      test('matches prefix', () => {
        expect(startsWithHttp('https://example.com')).toBe(true);
        expect(startsWithHttp('http://localhost')).toBe(true);
        expect(startsWithHttp('ftp://server.com')).toBe(false);
      });
    });

    describe('EndsWith', () => {
      const endsWithJs = Predicate.EndsWith('.js');

      test('matches suffix', () => {
        expect(endsWithJs('app.js')).toBe(true);
        expect(endsWithJs('config.json')).toBe(false);
        expect(endsWithJs('test.spec.js')).toBe(true);
      });
    });

    describe('Includes', () => {
      const includesTest = Predicate.Includes('test');

      test('matches substring', () => {
        expect(includesTest('unit-test')).toBe(true);
        expect(includesTest('testing')).toBe(true);
        expect(includesTest('production')).toBe(false);
      });
    });

    describe('Matches', () => {
      const matchesEmail = Predicate.Matches(/^[^@]+@[^@]+\.[^@]+$/);

      test('matches regex pattern', () => {
        expect(matchesEmail('user@example.com')).toBe(true);
        expect(matchesEmail('invalid-email')).toBe(false);
        expect(matchesEmail('user@domain')).toBe(false);
      });
    });
  });

  describe('Boolean Combinators', () => {
    describe('And', () => {
      const isPositiveInteger = Predicate.And(
        Predicate.Number(),
        Predicate.Integer(),
        Predicate.Min(0, false)
      );

      test('requires all predicates to pass', () => {
        expect(isPositiveInteger(5)).toBe(true);
        expect(isPositiveInteger(0)).toBe(false); // not > 0
        expect(isPositiveInteger(3.14)).toBe(false); // not integer
        expect(isPositiveInteger('5')).toBe(false); // not number
      });

      test('works with empty predicate list', () => {
        const alwaysTrue = Predicate.And();
        expect(alwaysTrue('anything')).toBe(true);
      });
    });

    describe('Or', () => {
      const isStringOrNumber = Predicate.Or(Predicate.AnyString(), Predicate.Number());

      test('passes if any predicate passes', () => {
        expect(isStringOrNumber('hello')).toBe(true);
        expect(isStringOrNumber(42)).toBe(true);
        expect(isStringOrNumber(null)).toBe(false);
        expect(isStringOrNumber([])).toBe(false);
      });

      test('works with empty predicate list', () => {
        const alwaysFalse = Predicate.Or();
        expect(alwaysFalse('anything')).toBe(false);
      });
    });

    describe('Not', () => {
      const isNotString = Predicate.Not(Predicate.AnyString());

      test('inverts predicate result', () => {
        expect(isNotString('hello')).toBe(false);
        expect(isNotString(42)).toBe(true);
        expect(isNotString(null)).toBe(true);
      });
    });
  });

  describe('Array Predicates', () => {
    describe('ArrayEndsWith', () => {
      const endsWithStringNumber = Predicate.ArrayEndsWith(
        Predicate.AnyString(),
        Predicate.Number()
      );

      test('matches tail pattern', () => {
        expect(endsWithStringNumber(['a', 'b', 'dude', 42])).toBe(true);
        expect(endsWithStringNumber(['hello', 42])).toBe(true);
        expect(endsWithStringNumber(['a', 42, 'dude'])).toBe(false);
      });

      test('handles edge cases', () => {
        expect(endsWithStringNumber([])).toBe(false);
        expect(endsWithStringNumber(['hello'])).toBe(false); // too short
        expect(endsWithStringNumber('not-array')).toBe(false);
        expect(endsWithStringNumber(null)).toBe(false);
      });

      test('empty pattern matches any array', () => {
        const matchesAny = Predicate.ArrayEndsWith();
        expect(matchesAny([])).toBe(true);
        expect(matchesAny([1, 2, 3])).toBe(true);
        expect(matchesAny('string')).toBe(false);
      });
    });
  });

  describe('Utility Predicates', () => {
    describe('Truthy', () => {
      const isTruthy = Predicate.Truthy();

      test('matches truthy values', () => {
        expect(isTruthy(true)).toBe(true);
        expect(isTruthy(1)).toBe(true);
        expect(isTruthy('hello')).toBe(true);
        expect(isTruthy([])).toBe(true);
        expect(isTruthy({})).toBe(true);
      });

      test('rejects falsy values', () => {
        expect(isTruthy(false)).toBe(false);
        expect(isTruthy(0)).toBe(false);
        expect(isTruthy('')).toBe(false);
        expect(isTruthy(null)).toBe(false);
        expect(isTruthy(undefined)).toBe(false);
        expect(isTruthy(NaN)).toBe(false);
      });
    });

    describe('Falsy', () => {
      const isFalsy = Predicate.Falsy();

      test('matches falsy values', () => {
        expect(isFalsy(false)).toBe(true);
        expect(isFalsy(0)).toBe(true);
        expect(isFalsy('')).toBe(true);
        expect(isFalsy(null)).toBe(true);
        expect(isFalsy(undefined)).toBe(true);
        expect(isFalsy(NaN)).toBe(true);
      });

      test('rejects truthy values', () => {
        expect(isFalsy(true)).toBe(false);
        expect(isFalsy(1)).toBe(false);
        expect(isFalsy('hello')).toBe(false);
      });
    });

    describe('Defined', () => {
      const isDefined = Predicate.Defined();

      test('accepts all values except null/undefined', () => {
        expect(isDefined(0)).toBe(true);
        expect(isDefined('')).toBe(true);
        expect(isDefined(false)).toBe(true);
        expect(isDefined([])).toBe(true);
        expect(isDefined({})).toBe(true);
      });

      test('rejects null and undefined', () => {
        expect(isDefined(null)).toBe(false);
        expect(isDefined(undefined)).toBe(false);
      });
    });

    describe('OneOf', () => {
      const isColor = Predicate.OneOf('red', 'green', 'blue');

      test('matches enumerated values', () => {
        expect(isColor('red')).toBe(true);
        expect(isColor('green')).toBe(true);
        expect(isColor('blue')).toBe(true);
        expect(isColor('yellow')).toBe(false);
        expect(isColor('RED')).toBe(false); // case sensitive
      });

      test('works with different types', () => {
        const isMixed = Predicate.OneOf(1, 'hello', true, null);
        expect(isMixed(1)).toBe(true);
        expect(isMixed('hello')).toBe(true);
        expect(isMixed(true)).toBe(true);
        expect(isMixed(null)).toBe(true);
        expect(isMixed(false)).toBe(false);
      });

      test('handles empty enumeration', () => {
        const isNone = Predicate.OneOf();
        expect(isNone('anything')).toBe(false);
      });
    });

    describe('Length', () => {
      test('exact length constraint', () => {
        const isLength3 = Predicate.Length(3);
        expect(isLength3('abc')).toBe(true);
        expect(isLength3([1, 2, 3])).toBe(true);
        expect(isLength3('ab')).toBe(false);
        expect(isLength3([1, 2, 3, 4])).toBe(false);
      });

      test('length range constraint', () => {
        const isLength2to4 = Predicate.Length(2, 4);
        expect(isLength2to4('ab')).toBe(true);
        expect(isLength2to4('abc')).toBe(true);
        expect(isLength2to4('abcd')).toBe(true);
        expect(isLength2to4('a')).toBe(false);
        expect(isLength2to4('abcde')).toBe(false);
      });

      test('handles values without length property', () => {
        const hasLength = Predicate.Length(1);
        expect(hasLength(42)).toBe(false);
        expect(hasLength(null)).toBe(false);
        expect(hasLength(undefined)).toBe(false);
        expect(hasLength({})).toBe(false);
      });

      test('works with typed arrays', () => {
        const isLength2 = Predicate.Length(2);
        expect(isLength2(new Uint8Array(2))).toBe(true);
        expect(isLength2(new Uint8Array(3))).toBe(false);
      });
    });
  });

  describe('Helper Functions', () => {
    describe('satisfies', () => {
      test('applies predicate to value', () => {
        const isEven = (n) => n % 2 === 0;
        expect(satisfies(isEven, 4)).toBe(true);
        expect(satisfies(isEven, 3)).toBe(false);
      });
    });

    describe('satisfiesAll', () => {
      test('validates multiple values against corresponding predicates', () => {
        const validators = satisfiesAll(
          Predicate.AnyString(),
          Predicate.Number(),
          Predicate.OneOf('a', 'b')
        );

        expect(validators('hello', 42, 'a')).toBe(true);
        expect(validators('hello', 42, 'c')).toBe(false);
        expect(validators('hello', 'not-number', 'a')).toBe(false);
      });

      test('requires equal length arrays', () => {
        const validators = satisfiesAll(Predicate.AnyString(), Predicate.Number());

        expect(validators('hello', 42)).toBe(true);
        expect(validators('hello')).toBe(false); // too few values
        expect(validators('hello', 42, 'extra')).toBe(false); // too many values
      });

      test('handles empty predicate list', () => {
        const validators = satisfiesAll();
        expect(validators()).toBe(true);
      });
    });
  });

  describe('Real-world Usage Examples', () => {
    test('form validation', () => {
      const validateEmail = Predicate.And(
        Predicate.AnyString(),
        Predicate.Length(1, 100),
        Predicate.Matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
      );

      const validateAge = Predicate.And(
        Predicate.Number(),
        Predicate.Integer(),
        Predicate.Min(0),
        Predicate.Max(150)
      );

      expect(satisfies(validateEmail, 'user@example.com')).toBe(true);
      expect(satisfies(validateEmail, 'invalid-email')).toBe(false);
      expect(satisfies(validateAge, 25)).toBe(true);
      expect(satisfies(validateAge, -5)).toBe(false);
    });

    test('API response validation', () => {
      const hasRequiredFields = Predicate.And(
        Predicate.In('id'),
        Predicate.In('name'),
        Predicate.In('status')
      );

      const isValidStatus = Predicate.OneOf('active', 'inactive', 'pending');

      const response = { id: 1, name: 'John', status: 'active', extra: 'data' };
      expect(satisfies(hasRequiredFields, response)).toBe(true);
      expect(satisfies(isValidStatus, response.status)).toBe(true);
    });

    test('file path validation', () => {
      const isValidImagePath = Predicate.And(
        Predicate.AnyString(),
        Predicate.Or(
          Predicate.EndsWith('.jpg'),
          Predicate.EndsWith('.png'),
          Predicate.EndsWith('.gif')
        ),
        Predicate.Not(Predicate.Includes('..')) // security check
      );

      expect(satisfies(isValidImagePath, 'photo.jpg')).toBe(true);
      expect(satisfies(isValidImagePath, '../../../etc/passwd')).toBe(false);
      expect(satisfies(isValidImagePath, 'document.pdf')).toBe(false);
    });

    test('configuration validation', () => {
      const validatePort = Predicate.And(
        Predicate.Integer(),
        Predicate.Min(1),
        Predicate.Max(65535)
      );

      const validateEnv = Predicate.OneOf('development', 'staging', 'production');

      const config = { port: 3000, env: 'development', debug: true };
      expect(satisfies(validatePort, config.port)).toBe(true);
      expect(satisfies(validateEnv, config.env)).toBe(true);
    });

    test('array processing pipeline', () => {
      const isValidUser = Predicate.And(
        Predicate.In('name'),
        Predicate.In('email'),
        Predicate.In('age')
      );

      const users = [
        { name: 'Alice', email: 'alice@test.com', age: 30 },
        { name: 'Bob', age: 25 }, // missing email
        { name: 'Charlie', email: 'charlie@test.com', age: 35 },
      ];

      const validUsers = users.filter((user) => satisfies(isValidUser, user));
      expect(validUsers).toHaveLength(2);
      expect(validUsers.map((u) => u.name)).toEqual(['Alice', 'Charlie']);
    });

    test('unit range validator from original example', () => {
      const unit = Predicate.And(Predicate.Number(), Predicate.Min(0), Predicate.Max(1));

      expect(satisfies(unit, 0)).toBe(true);
      expect(satisfies(unit, 0.5)).toBe(true);
      expect(satisfies(unit, 1)).toBe(true);
      expect(satisfies(unit, -0.1)).toBe(false);
      expect(satisfies(unit, 1.1)).toBe(false);
      expect(satisfies(unit, '0.5')).toBe(false);
    });

    test('path pattern matching from original example', () => {
      const pathCrit = Predicate.ArrayEndsWith(
        Predicate.AnyString(), // any string
        Predicate.Equal('leaf'), // followed by 'leaf'
        Predicate.Integer() // ending with an int
      );

      expect(satisfies(pathCrit, ['stem', 'leaf', 42])).toBe(true);
      expect(satisfies(pathCrit, [2, 42, 'stem', 'leaf', 1])).toBe(true);
      expect(satisfies(pathCrit, [42, 'branch', 'stem'])).toBe(false);
      expect(satisfies(pathCrit, ['leaf', 'stem'])).toBe(false); // too short
    });
  });
});
