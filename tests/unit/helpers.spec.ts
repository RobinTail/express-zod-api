import {combineEndpointAndMiddlewareInputSchemas, getInitialInput, isLoggerConfig} from '../../src/helpers';
import {createMiddleware, z} from '../../src';
import {Request} from 'express';

describe('Helpers', () => {
  describe('combineEndpointAndMiddlewareInputSchemas()', () => {
    test('Should merge input schemas', () => {
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
      ];
      const endpointInput = z.object({
        four: z.boolean()
      });
      const result = combineEndpointAndMiddlewareInputSchemas(endpointInput, middlewares);
      expect(result).toBeInstanceOf(z.ZodObject);
      expect(result.shape).toMatchSnapshot();
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
});
