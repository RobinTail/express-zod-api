import {ZodObject} from 'zod';
import {combineEndpointAndMiddlewareInputSchemas} from '../../src/helpers';
import {createMiddleware, z} from '../../src';

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
});
