import * as make from '../src/make';
import * as jsc from 'jsverify';
import { TestClass } from './test-class';
import { Type } from '../src/reflection-type';

describe('named', () => {
  it('uses the maker from name', () => {
    const type: Type = {
      type: 'named',
      reference: {
        name: 'aa',
        definition: 1 as any,
        isA: 1 as any,
        maker: make.fromReflection({ type: 'string' })
      }
    };
    const fun = make.fromReflection(type);
    const result = fun('aaa').success();
    expect(result).toEqual('aaa');
  });
});

describe('union', () => {
  it('succeeds if only one match', () => {
    const type: Type = {
      type: 'union',
      options: [
        {
          type: 'object',
          additionalProperties: false,
          properties: { a: { required: true, value: { type: 'string' } } }
        },
        {
          type: 'object',
          additionalProperties: false,
          properties: { a: { required: true, value: { type: 'number' } } }
        }
      ]
    };
    const fun = make.fromReflection(type);
    expect(fun({ a: 1 }).success()).toEqual({ a: 1 });
  });

  it('prefers matching ValueClass', () => {
    const type: Type = {
      type: 'union',
      options: [
        {
          type: 'unknown'
        },
        {
          type: 'named',
          reference: {
            name: 'aa',
            definition: 1 as any,
            isA: 1 as any,
            maker: TestClass.make
          }
        }
      ]
    };
    const fun = make.fromReflection(type);
    const test = TestClass.make({ a: ['a'], b: 'b' }).success();
    expect(fun(test).success()).toEqual(test);
  });

  it('fails if multiple values classes match', () => {
    const type: Type = {
      type: 'union',
      options: [
        {
          type: 'unknown'
        },
        {
          type: 'named',
          reference: {
            name: 'aa',
            definition: 1 as any,
            isA: 1 as any,
            maker: TestClass.make
          }
        },
        {
          type: 'named',
          reference: {
            name: 'aa',
            definition: 1 as any,
            isA: 1 as any,
            maker: TestClass.make
          }
        }
      ]
    };
    const fun = make.fromReflection(type);
    const test = TestClass.make({ a: ['a'], b: 'b' }).success();
    expect(fun(test).isSuccess()).toBeFalsy();
  });

  it('fails on multiple matches', () => {
    const type: Type = {
      type: 'union',
      options: [
        {
          type: 'unknown'
        },
        {
          type: 'string'
        }
      ]
    };
    const fun = make.fromReflection(type);
    expect(fun('x').isSuccess()).toBeFalsy();
  });
});

describe('string', () => {
  it('rejects if the pattern does not match', () => {
    const type: Type = {
      type: 'string',
      pattern: 'a+'
    };
    const fun = make.fromReflection(type);
    expect(fun('b').errors[0].error).toEqual('b does not match pattern /a+/');
  });

  it('accepts if the pattern matches', () => {
    const type: Type = {
      type: 'string',
      pattern: 'a+'
    };
    const fun = make.fromReflection(type);
    fun('aaa').success();
  });

  it('throws on invalid regex', () => {
    const type: Type = {
      type: 'string',
      pattern: '\\'
    };
    expect(() => make.fromReflection(type)).toThrow(
      "pattern for 'type: string' is not valid: Invalid regular expression"
    );
  });

  it('accepts if format is not defined', () => {
    const type: Type = {
      type: 'string',
      format: 'some-format'
    };
    const fun = make.fromReflection(type);
    fun('b').success();
  });

  it('rejects if format rejects', () => {
    make.registerFormat('some-rejecting-format', () =>
      make.Make.error([{ path: [], error: 'some error' }])
    );
    const type: Type = {
      type: 'string',
      format: 'some-rejecting-format'
    };
    const fun = make.fromReflection(type);
    expect(fun('b').errors[0].error).toEqual('some error');
  });

  it('accepts if format accepts', () => {
    make.registerFormat('some-accepting-format', () => make.Make.ok(undefined));
    const type: Type = {
      type: 'string',
      format: 'some-accepting-format'
    };
    const fun = make.fromReflection(type);
    expect(fun('b').success()).toEqual('b');
  });
});

describe('intersection', () => {
  it('applies all makers to value in succession', () => {
    const type: Type = {
      type: 'intersection',
      options: [
        {
          type: 'object',
          additionalProperties: true,
          properties: { a: { required: true, value: { type: 'string' } } }
        },
        {
          type: 'object',
          additionalProperties: true,
          properties: { b: { required: true, value: { type: 'number' } } }
        }
      ]
    };
    const fun = make.fromReflection(type);
    expect(fun({ a: 'xxx', b: 1 }).success()).toEqual({ a: 'xxx', b: 1 });
  });
});

describe('unknown', () => {
  jsc.property('allows anything', jsc.json, async item => {
    const fun = make.fromReflection({ type: 'unknown' });
    expect(fun(item).success()).toEqual(item);
    if (item && typeof item === 'object') {
      expect(fun(item).success() !== item).toBeTruthy();
    }
    return true;
  });
});

describe('number', () => {
  it('enforces minimum if passed', () => {
    const fun = make.fromReflection({ type: 'number', minimum: 3 });
    expect(fun(2).errors[0].error).toMatch('expected a number greater or equal to');
    expect(fun(3).isSuccess()).toBeTruthy();
  });
  it('enforces maximum if passed', () => {
    const fun = make.fromReflection({ type: 'number', maximum: 3 });
    expect(fun(4).errors[0].error).toMatch('expected a number smaller or equal to');
    expect(fun(3).isSuccess()).toBeTruthy();
  });
});

describe('array', () => {
  it('keeps the order', () => {
    const fun = make.fromReflection({ type: 'array', items: { type: 'string' } });
    expect(fun(['a', 'b']).success()).toEqual(['a', 'b']);
  });
  it('enforces min size if passed', () => {
    const fun = make.fromReflection({ type: 'array', items: { type: 'string' }, minItems: 3 });
    expect(fun(['a', 'b']).errors[0].error).toMatch('expected an array of minimum length');
    expect(fun(['a', 'b', 'c']).isSuccess()).toBeTruthy();
  });
  it('enforces max size if passed', () => {
    const fun = make.fromReflection({ type: 'array', items: { type: 'string' }, maxItems: 3 });
    expect(fun(['a', 'b', 'c', 'd']).errors[0].error).toMatch(
      'expected an array of maximum length'
    );
    expect(fun(['a', 'b', 'c']).isSuccess()).toBeTruthy();
  });
});

describe('object', () => {
  describe('magic fields', () => {
    it('disallows __proto__', () => {
      const properties = Object.create(null);
      properties.__proto__ = { required: true, value: { type: 'string' } };
      const fun = make.fromReflection({
        type: 'object',
        additionalProperties: false,
        properties
      });
      const value = JSON.parse(`{"__proto__": 1}`);
      expect(fun(value).errors[0].error).toEqual(
        'Using __proto__ as field of an object is not allowed'
      );
    });

    it('disallows array', () => {
      const fun = make.fromReflection({
        type: 'object',
        properties: {},
        additionalProperties: { type: 'unknown' }
      });
      expect(fun([]).errors[0].error).toEqual('expected an object, but got "[]" instead.');
    });

    it('disallows constructor', () => {
      const properties = Object.create(null);
      properties.constructor = { value: { type: 'number' }, required: true };
      const fun = make.fromReflection({ type: 'object', additionalProperties: false, properties });
      const value = JSON.parse(`{"constructor": 1}`);
      expect(fun(value).errors[0].error).toEqual(
        'Using constructor as field of an object is not allowed'
      );
    });

    it('disallows __proto__ in additionalFields', () => {
      const fun = make.fromReflection({
        type: 'object',
        properties: {},
        additionalProperties: { type: 'number' }
      });
      const value = JSON.parse(`{"__proto__": 1}`);
      expect(fun(value).errors[0].error).toEqual(
        'Using __proto__ as objects additional field is not allowed.'
      );
    });

    it('disallows constructor in additionalFields', () => {
      const fun = make.fromReflection({
        type: 'object',
        properties: {},
        additionalProperties: { type: 'number' }
      });
      const value = JSON.parse(`{"constructor": 1}`);
      expect(fun(value).errors[0].error).toEqual(
        'Using constructor as objects additional field is not allowed.'
      );
    });
  });

  it('drops unknown properties if told to', () => {
    const fun = make.fromReflection({
      type: 'object',
      additionalProperties: false,
      properties: { a: { value: { type: 'number' }, required: true } }
    });
    expect(fun({ a: 1, missing: 'a' }, { unknownField: 'drop' }).success()).toEqual({ a: 1 });
  });

  it('drops unknown properties in nested objects', () => {
    const fun = make.fromReflection({
      type: 'object',
      additionalProperties: false,
      properties: {
        a: {
          value: {
            type: 'object',
            properties: { b: { value: { type: 'number' }, required: true } },
            additionalProperties: false
          },
          required: true
        }
      }
    });
    expect(fun({ a: { b: 1, missing: 'value' } }, { unknownField: 'drop' }).success()).toEqual({
      a: { b: 1 }
    });
  });

  it('drops unknown properties in nested additional prop objects', () => {
    const fun = make.fromReflection({
      type: 'object',
      additionalProperties: {
        type: 'object',
        properties: { b: { value: { type: 'number' }, required: true } },
        additionalProperties: false
      },
      properties: {}
    });
    expect(fun({ a: { b: 1, missing: 'value' } }, { unknownField: 'drop' }).success()).toEqual({
      a: { b: 1 }
    });
  });

  it('disallows extra fields', () => {
    const fun = make.fromReflection({
      type: 'object',
      additionalProperties: false,
      properties: { a: { value: { type: 'number' }, required: true } }
    });
    expect(fun({ a: 1, missing: 'a' }).isError()).toBeTruthy();
  });

  it('allows fields', () => {
    const fun = make.fromReflection({
      type: 'object',
      additionalProperties: false,
      properties: { a: { value: { type: 'number' }, required: true } }
    });
    expect(fun({ a: 1 }).isSuccess()).toBeTruthy();
  });

  it('allows additional props', () => {
    const fun = make.fromReflection({
      type: 'object',
      additionalProperties: { type: 'string' },
      properties: {}
    });
    expect(fun({ a: 'xxx' }).success()).toEqual({ a: 'xxx' });
  });

  it('prefers specified field to additional props', () => {
    const fun = make.fromReflection({
      type: 'object',
      additionalProperties: { type: 'string' },
      properties: {
        a: { value: { type: 'number' }, required: true }
      }
    });
    expect(fun({ a: 1 }).success()).toEqual({ a: 1 });
  });

  it('allows undefined props', () => {
    const fun = make.fromReflection({
      type: 'object',
      additionalProperties: false,
      properties: {
        a: { value: { type: 'number' }, required: false }
      }
    });
    expect(fun({ a: undefined }).success()).toEqual({});
  });
});
