import {createMiddleware, z} from '../src';

describe('Middleware', () => {
  describe('createMiddleware()', () => {
    test('Should simply return its argument', () => {
      const definition = {
        input: z.object({
          something: z.number()
        }),
        middleware: jest.fn()
      };
      const middleware = createMiddleware(definition);
      expect(middleware).toStrictEqual(definition);
    });
  });
});
