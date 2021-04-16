import {ZodObject} from 'zod';
import {combineEndpointAndMiddlewareInputSchemas, getInitialInput} from '../../src/helpers';
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
      expect(result).toBeInstanceOf(ZodObject);
      expect(JSON.parse(JSON.stringify(result.shape))).toEqual({
        four: {t: 'boolean'},
        one: {t: 'string', validation: {}},
        three: {t: 'null'},
        two: {t: 'number'}
      });
      /*
      expect(result.shape).toEqual({
        one: z.string(),
        two: z.number(),
        three: z.null(),
        four: z.boolean()
      });
      */
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
});
