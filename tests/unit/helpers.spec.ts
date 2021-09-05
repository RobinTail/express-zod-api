import {expectType} from 'tsd';
import {
  combineEndpointAndMiddlewareInputSchemas,
  extractObjectSchema,
  getInitialInput,
  getMessageFromError,
  getStatusCodeFromError,
  isLoggerConfig,
  OutputMarker
} from '../../src/helpers';
import {createMiddleware, z, createHttpError, markOutput, createApiResponse} from '../../src';
import {Request} from 'express';
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
  });
  
  describe('getInitialInput()', () => {
    test('should return body for POST, PUT and PATCH requests', () => {
      expect(getInitialInput({
        body: 'body',
        method: 'POST'
      } as Request)).toEqual('body');
      expect(getInitialInput({
        body: 'body',
        method: 'PUT'
      } as Request)).toEqual('body');
      expect(getInitialInput({
        body: 'body',
        method: 'PATCH'
      } as Request)).toEqual('body');
    });
    test('should return query for GET requests', () => {
      expect(getInitialInput({
        query: 'query',
        method: 'GET'
      } as unknown as Request)).toEqual('query');
    });
    test('should return both body and query for DELETE and unknown requests', () => {
      expect(getInitialInput({
        query: { a: 'query' },
        body: {b: 'body'},
        method: 'DELETE'
      } as unknown as Request)).toEqual({
        a: 'query',
        b: 'body'
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

  describe('createApiResponse()', () => {
    test('should accept an array of mime types', () => {
      const output = z.object({});
      expect(createApiResponse(output, ['something', 'anything'])).toEqual({
        schema: output,
        mimeTypes: ['something', 'anything']
      });
    });

    test('should accept a single mime type', () => {
      const output = z.object({});
      expect(createApiResponse(output, 'something')).toEqual({
        schema: output,
        mimeTypes: ['something']
      });
    });

    test('should assume json mime type by default', () => {
      const output = z.object({});
      expect(createApiResponse(output, )).toEqual({
        schema: output,
        mimeTypes: ['application/json']
      });
    });
  });
});
