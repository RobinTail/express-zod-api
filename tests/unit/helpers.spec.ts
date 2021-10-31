import {expectType} from 'tsd';
import {
  combinations,
  combineEndpointAndMiddlewareInputSchemas,
  extractObjectSchema,
  getExamples,
  getInitialInput,
  getMessageFromError,
  getStatusCodeFromError,
  isLoggerConfig,
  OutputMarker
} from '../../src/helpers';
import {createMiddleware, z, createHttpError, markOutput, withMeta} from '../../src';
import {Request} from 'express';
import {getMeta} from '../../src/metadata';
import {MiddlewareDefinition} from '../../src/middleware';
import {serializeSchemaForTest} from '../helpers';

describe('Helpers', () => {
  describe('combineEndpointAndMiddlewareInputSchemas()', () => {
    test('Should merge input object schemas', () => {
      const middlewares = [
        createMiddleware({
          input: z.object({
            one: z.string()
          }),
          middleware: jest.fn()
        }),
        createMiddleware({
          input: z.object({
            two: z.number()
          }),
          middleware: jest.fn()
        }),
        createMiddleware({
          input: z.object({
            three: z.null()
          }),
          middleware: jest.fn()
        }),
      ] as MiddlewareDefinition<any, any, any>[];
      const endpointInput = z.object({
        four: z.boolean()
      });
      const result = combineEndpointAndMiddlewareInputSchemas(endpointInput, middlewares);
      expect(result).toBeInstanceOf(z.ZodObject);
      expect(serializeSchemaForTest(result)).toMatchSnapshot();
    });

    test('Should merge union object schemas', () => {
      const middlewares = [
        createMiddleware({
          input: z.object({
            one: z.string()
          }).or(z.object({
            two: z.number()
          })),
          middleware: jest.fn()
        }),
        createMiddleware({
          input: z.object({
            three: z.null()
          }).or(z.object({
            four: z.boolean()
          })),
          middleware: jest.fn()
        }),
      ] as MiddlewareDefinition<any, any, any>[];
      const endpointInput = z.object({
        five: z.string()
      }).or(z.object({
        six: z.number()
      }));
      const result = combineEndpointAndMiddlewareInputSchemas(endpointInput, middlewares);
      expect(result).toBeInstanceOf(z.ZodObject);
      expect(serializeSchemaForTest(result)).toMatchSnapshot();
    });

    test('Should merge intersection object schemas', () => {
      const middlewares = [
        createMiddleware({
          input: z.object({
            one: z.string()
          }).and(z.object({
            two: z.number()
          })),
          middleware: jest.fn()
        }),
        createMiddleware({
          input: z.object({
            three: z.null()
          }).and(z.object({
            four: z.boolean()
          })),
          middleware: jest.fn()
        }),
      ] as MiddlewareDefinition<any, any, any>[];
      const endpointInput = z.object({
        five: z.string()
      }).and(z.object({
        six: z.number()
      }));
      const result = combineEndpointAndMiddlewareInputSchemas(endpointInput, middlewares);
      expect(result).toBeInstanceOf(z.ZodObject);
      expect(serializeSchemaForTest(result)).toMatchSnapshot();
    });

    test('Should merge mixed object schemas', () => {
      const middlewares = [
        createMiddleware({
          input: z.object({
            one: z.string()
          }).and(z.object({
            two: z.number()
          })),
          middleware: jest.fn()
        }),
        createMiddleware({
          input: z.object({
            three: z.null()
          }).or(z.object({
            four: z.boolean()
          })),
          middleware: jest.fn()
        }),
      ] as MiddlewareDefinition<any, any, any>[];
      const endpointInput = z.object({
        five: z.string()
      });
      const result = combineEndpointAndMiddlewareInputSchemas(endpointInput, middlewares);
      expect(result).toBeInstanceOf(z.ZodObject);
      expect(serializeSchemaForTest(result)).toMatchSnapshot();
    });

    test('Should merge examples in case of using withMeta()', () => {
      const middlewares = [
        createMiddleware({
          input: withMeta(z.object({
            one: z.string()
          }).and(z.object({
            two: z.number()
          }))).example({
            one: 'test',
            two: 123
          }),
          middleware: jest.fn()
        }),
        createMiddleware({
          input: withMeta(z.object({
            three: z.null()
          }).or(z.object({
            four: z.boolean()
          }))).example({
            three: null,
            four: true
          }),
          middleware: jest.fn()
        }),
      ] as MiddlewareDefinition<any, any, any>[];
      const endpointInput = withMeta(z.object({
        five: z.string()
      })).example({
        five: 'some'
      });
      const result = combineEndpointAndMiddlewareInputSchemas(endpointInput, middlewares);
      expect(getMeta(result, 'examples')).toEqual([{
        one: 'test',
        two: 123,
        three: null,
        four: true,
        five: 'some'
      }]);
    });
  });
  
  describe('getInitialInput()', () => {
    test('should return body for POST, PUT and PATCH requests by default', () => {
      expect(getInitialInput({
        body: {
          param: 123
        },
        method: 'POST',
        header: () => 'application/json'
      } as unknown as Request, undefined)).toEqual({
        param: 123
      });
      expect(getInitialInput({
        body: {
          param: 123
        },
        method: 'PUT'
      } as Request, {})).toEqual({
        param: 123
      });
      expect(getInitialInput({
        body: {
          param: 123
        },
        method: 'PATCH'
      } as Request, undefined)).toEqual({
        param: 123
      });
    });
    test('should return query for GET requests by default', () => {
      expect(getInitialInput({
        query: {
          param: 123
        },
        method: 'GET'
      } as unknown as Request, {})).toEqual({
        param: 123
      });
    });
    test('should return both body and query for DELETE and unknown requests by default', () => {
      expect(getInitialInput({
        query: { a: 'query' },
        body: { b: 'body' },
        method: 'DELETE'
      } as unknown as Request, undefined)).toEqual({
        a: 'query',
        b: 'body'
      });
    });
    test('should return body and files on demand for POST by default', () => {
      expect(getInitialInput({
        body: {
          param: 123
        },
        files: {
          file: '456'
        },
        method: 'POST',
        header: () => 'multipart/form-data; charset=utf-8'
      } as unknown as Request, {})).toEqual({
        param: 123,
        file: '456'
      });
    });
    test('Issue 158: should return query and body for POST on demand', () => {
      expect(getInitialInput({
        body: {
          a: 'body'
        },
        query: {
          b: 'query'
        },
        method: 'POST',
        header: () => 'application/json'
      } as unknown as Request, {
        post: ['query', 'body']
      })).toEqual({
        a: 'body',
        b: 'query'
      });
    });
  });

  describe('isLoggerConfig()', () => {
    test('Should identify the valid logger config', () => {
      expect(isLoggerConfig({
        level: 'debug',
        color: true,
      })).toBeTruthy();
    });
    test('Should reject the object with invalid properties', () => {
      expect(isLoggerConfig({
        level: 'something',
        color: true,
      })).toBeFalsy();
      expect(isLoggerConfig({
        level: 'debug',
        color: null,
      })).toBeFalsy();
    });
    test('Should reject the object with missing properties', () => {
      expect(isLoggerConfig({
        level: 'something',
      })).toBeFalsy();
      expect(isLoggerConfig({
        color: null,
      })).toBeFalsy();
    });
    test('Should reject non-objects', () => {
      expect(isLoggerConfig([1,2,3])).toBeFalsy();
      expect(isLoggerConfig('something')).toBeFalsy();
    });
  });

  describe('extractObjectSchema()', () => {
    test('should pass the object schema through', () => {
      const subject = extractObjectSchema(z.object({
        one: z.string()
      }));
      expect(subject).toBeInstanceOf(z.ZodObject);
      expect(serializeSchemaForTest(subject)).toMatchSnapshot();
    });

    test('should return object schema for the union of object schemas', () => {
      const subject = extractObjectSchema(z.object({
        one: z.string()
      }).or(z.object({
        two: z.number()
      })));
      expect(subject).toBeInstanceOf(z.ZodObject);
      expect(serializeSchemaForTest(subject)).toMatchSnapshot();
    });

    test('should return object schema for the intersection of object schemas', () => {
      const subject = extractObjectSchema(z.object({
        one: z.string()
      }).and(z.object({
        two: z.number()
      })));
      expect(subject).toBeInstanceOf(z.ZodObject);
      expect(serializeSchemaForTest(subject)).toMatchSnapshot();
    });

    test('should preserve examples', () => {
      const objectSchema = withMeta(z.object({
        one: z.string()
      })).example({
        one: 'test'
      });
      expect(getMeta(extractObjectSchema(objectSchema), 'examples')).toEqual([{
        one: 'test'
      }]);

      const unionSchema = withMeta(z.object({
        one: z.string()
      }).or(z.object({
        two: z.number()
      }))).example({
        one: 'test1'
      }).example({
        two: 123
      });
      expect(getMeta(extractObjectSchema(unionSchema), 'examples')).toEqual([
        {one: 'test1'},
        {two: 123}
      ]);

      const intersectionSchema = withMeta(z.object({
        one: z.string()
      }).and(z.object({
        two: z.number()
      }))).example({
        one: 'test1',
        two: 123
      });
      expect(getMeta(extractObjectSchema(intersectionSchema), 'examples')).toEqual([{
        one: 'test1',
        two: 123
      }]);
    });
  });

  describe('getMessageFromError()', () => {
    test('should compile a string from ZodError', () => {
      const error = new z.ZodError([
        {
          code: 'invalid_type',
          path: ['user', 'id'],
          message: 'expected number, got string',
          expected: 'number',
          received: 'string'
        },
        {
          code: 'invalid_type',
          path: ['user', 'name'],
          message: 'expected string, got number',
          expected: 'string',
          received: 'number'
        }
      ]);
      expect(getMessageFromError(error)).toMatchSnapshot();
    });

    test('should pass message from other error types', () => {
      expect(getMessageFromError(
        createHttpError(502, 'something went wrong'))
      ).toMatchSnapshot();
      expect(getMessageFromError(
        new Error('something went wrong'))
      ).toMatchSnapshot();
    });
  });

  describe('getStatusCodeFromError()', () => {
    test('should get status code from HttpError', () => {
      expect(getStatusCodeFromError(createHttpError(403, 'Access denied')))
        .toEqual(403);
    });

    test('should return 400 for ZodError', () => {
      const error = new z.ZodError([
        {
          code: 'invalid_type',
          path: ['user', 'id'],
          message: 'expected number, got string',
          expected: 'number',
          received: 'string'
        }
      ]);
      expect(getStatusCodeFromError(error)).toEqual(400);
    });

    test('should return 500 for other errors', () => {
      expect(getStatusCodeFromError(new Error('something went wrong')))
        .toEqual(500);
    });
  });

  describe('markOutput()', () => {
    test('should change the type of schema', () => {
      const output = z.object({});
      expect(markOutput(output)).toEqual(output);
      expectType<OutputMarker>(markOutput(output));
    });
  });

  describe('getExamples()', () => {
    test('should return an empty array in case examples are not set', () => {
      expect(getExamples(z.string(), true)).toEqual([]);
      expect(getExamples(z.string(), false)).toEqual([]);
      expect(getExamples(withMeta(z.string()), true)).toEqual([]);
      expect(getExamples(withMeta(z.string()), false)).toEqual([]);
    });
    test('should return examples as they are in case of no output parsing', () => {
      expect(getExamples(
        withMeta(z.string())
          .example('some')
          .example('another'),
        false
      )).toEqual(['some', 'another']);
    });
    test('should return parsed examples for output on demand', () => {
      expect(getExamples(
        withMeta(z.string().transform((v) => parseInt(v, 10)))
          .example('123')
          .example('456'),
        true
      )).toEqual([123, 456]);
    });
    test('should filter out invalid examples according to the schema in both cases', () => {
      expect(getExamples(
        withMeta(z.string())
          .example('some')
          .example(123 as unknown as string)
          .example('another'),
        false
      )).toEqual(['some', 'another']);
      expect(getExamples(
        withMeta(z.string().transform((v) => parseInt(v, 10)))
          .example('123')
          .example(null as unknown as string)
          .example('456'),
        true
      )).toEqual([123, 456]);
    });
  });

  describe('combinations()', () => {
    test('should run callback on each combination of items from two arrays', () => {
      expect(combinations([1, 2], [4, 5, 6])).toEqual({
        type: 'tuple',
        value: [
          [1, 4],
          [1, 5],
          [1, 6],
          [2, 4],
          [2, 5],
          [2, 6]
        ]
      });
    });

    test('should handle one or two arrays are empty', () => {
      expect(combinations([], [4,5,6])).toEqual({type: 'single', value: [4, 5, 6]});
      expect(combinations([1, 2, 3], [])).toEqual({type: 'single', value: [1, 2, 3]});
      expect(combinations([], [])).toEqual({type: 'single', value: []});
    });
  });
});
