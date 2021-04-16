import {createMiddleware, EndpointsFactory, z} from '../../src';
import {Endpoint} from '../../src/endpoint';
import {defaultResultHandler} from '../../src/result-handler';

describe('EndpointsFactory', () => {
  describe('.constructor()', () => {
    test('Should create the empty factory', () => {
      const factory = new EndpointsFactory();
      expect(factory).toBeInstanceOf(EndpointsFactory);
      expect(factory['middlewares']).toStrictEqual([]);
      expect(factory['resultHandler']).toStrictEqual(null);
    });

    test('Should create the factory with middleware and result handler', () => {
      const middlewares = [
        createMiddleware({
          input: z.object({
            n: z.number()
          }),
          middleware: jest.fn()
        })
      ];
      const factory = new EndpointsFactory(middlewares, defaultResultHandler);
      expect(factory['middlewares']).toStrictEqual(middlewares);
      expect(factory['resultHandler']).toStrictEqual(defaultResultHandler);
    });
  });

  describe('.addMiddleware()', () => {
    test('Should create a new factory with a middleware and the same result handler', () => {
      const factory = new EndpointsFactory([], defaultResultHandler);
      const middleware = createMiddleware({
        input: z.object({
          n: z.number()
        }),
        middleware: jest.fn()
      });
      const newFactory = factory.addMiddleware(middleware);
      expect(factory['middlewares']).toStrictEqual([]);
      expect(factory['resultHandler']).toStrictEqual(defaultResultHandler);
      expect(newFactory['middlewares']).toStrictEqual([middleware]);
      expect(newFactory['resultHandler']).toStrictEqual(defaultResultHandler);
    });
  });

  describe('.setResultHandler()', () => {
    test('Should create a new factory with a result handler and the same middlewares', () => {
      const middlewares = [
        createMiddleware({
          input: z.object({
            n: z.number()
          }),
          middleware: jest.fn()
        })
      ];
      const factory = new EndpointsFactory(middlewares);
      const newFactory = factory.setResultHandler(defaultResultHandler);
      expect(factory['middlewares']).toStrictEqual(middlewares);
      expect(newFactory['middlewares']).toStrictEqual(middlewares);
      expect(factory['resultHandler']).toStrictEqual(null);
      expect(newFactory['resultHandler']).toStrictEqual(defaultResultHandler);
    });
  });

  describe('.build()', () => {
    test('Should create an endpoint', () => {
      const middlewares = [
        createMiddleware({
          input: z.object({
            n: z.number()
          }),
          middleware: jest.fn()
        })
      ];
      const resultHandlerMock = jest.fn();
      const factory = new EndpointsFactory(middlewares, resultHandlerMock);
      const handlerMock = jest.fn();
      const endpoint = factory.build({
        methods: ['get'],
        input: z.object({
          s: z.string()
        }),
        output: z.object({
          b: z.boolean()
        }),
        handler: handlerMock
      });
      expect(endpoint).toBeInstanceOf(Endpoint);
      expect(endpoint.getMethods()).toStrictEqual(['get']);
      expect(endpoint['middlewares']).toStrictEqual(middlewares);
      expect(endpoint['inputSchema'].shape).toMatchSnapshot();
      expect(endpoint['outputSchema'].shape).toMatchSnapshot();
      expect(endpoint['handler']).toStrictEqual(handlerMock);
      expect(endpoint['resultHandler']).toStrictEqual(resultHandlerMock);
    });
  });
});
