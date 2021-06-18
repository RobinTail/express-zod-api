import {createMiddleware, EndpointsFactory, z} from '../../src';
import {Endpoint} from '../../src/endpoint';
import {defaultResultHandler, ResultHandlerDefinition} from '../../src/result-handler';
import {expectType} from 'tsd';

describe('EndpointsFactory', () => {
  describe('.constructor()', () => {
    test('Should create the empty factory', () => {
      const factory = new EndpointsFactory();
      expect(factory).toBeInstanceOf(EndpointsFactory);
      expect(factory['middlewares']).toStrictEqual([]);
      expect(factory['resultHandler']).toStrictEqual(null);
    });

    test('Should create the factory with middleware and result handler', () => {
      const middleware = createMiddleware({
        input: z.object({
          n: z.number()
        }),
        middleware: jest.fn()
      });
      const factory = new EndpointsFactory().addMiddleware(middleware).setResultHandler(defaultResultHandler);
      expect(factory['middlewares']).toStrictEqual([middleware]);
      expect(factory['resultHandler']).toStrictEqual(defaultResultHandler);
    });
  });

  describe('.addMiddleware()', () => {
    test('Should create a new factory with a middleware and the same result handler', () => {
      const factory = new EndpointsFactory().setResultHandler(defaultResultHandler);
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
      const middleware = createMiddleware({
        input: z.object({
          n: z.number()
        }),
        middleware: jest.fn()
      });
      const factory = new EndpointsFactory().addMiddleware(middleware);
      const newFactory = factory.setResultHandler(defaultResultHandler);
      expect(factory['middlewares']).toStrictEqual([middleware]);
      expect(newFactory['middlewares']).toStrictEqual([middleware]);
      expect(factory['resultHandler']).toStrictEqual(null);
      expect(newFactory['resultHandler']).toStrictEqual(defaultResultHandler);
    });
  });

  describe('.build()', () => {
    test('Should create an endpoint with simple middleware', () => {
      const middleware = createMiddleware({
        input: z.object({
          n: z.number()
        }),
        middleware: jest.fn()
      });
      const resultHandlerMock = { resultHandler: jest.fn() };
      const factory = new EndpointsFactory()
        .addMiddleware(middleware)
        .setResultHandler(resultHandlerMock as unknown as ResultHandlerDefinition<any, any>);
      const handlerMock = jest.fn();
      const endpoint = factory.build({
        method: 'get',
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
      expect(endpoint['middlewares']).toStrictEqual([middleware]);
      expect(endpoint['inputSchema'].shape).toMatchSnapshot();
      expect(endpoint['outputSchema'].shape).toMatchSnapshot();
      expect(endpoint['handler']).toStrictEqual(handlerMock);
      expect(endpoint['resultHandler']).toStrictEqual(resultHandlerMock);
      expectType<{
        n: z.ZodNumber,
        s: z.ZodString,
      }>(endpoint['inputSchema'].shape);
    });

    test('Should create an endpoint with intersection middleware', () => {
      const middleware = createMiddleware({
        input: z.object({
          n1: z.number()
        }).and(z.object({
          n2: z.number()
        })),
        middleware: jest.fn()
      });
      const resultHandlerMock = { resultHandler: jest.fn() };
      const factory = new EndpointsFactory()
        .addMiddleware(middleware)
        .setResultHandler(resultHandlerMock as unknown as ResultHandlerDefinition<any, any>);
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
      expect(endpoint['middlewares']).toStrictEqual([middleware]);
      expect(endpoint['inputSchema'].shape).toMatchSnapshot();
      expect(endpoint['outputSchema'].shape).toMatchSnapshot();
      expect(endpoint['handler']).toStrictEqual(handlerMock);
      expect(endpoint['resultHandler']).toStrictEqual(resultHandlerMock);
      expectType<{
        n1: z.ZodNumber,
        n2: z.ZodNumber,
        s: z.ZodString,
      }>(endpoint['inputSchema'].shape);
    });

    test('Should create an endpoint with union middleware',  () => {
      const middleware = createMiddleware({
        input: z.object({
          n1: z.number()
        }).or(z.object({
          n2: z.number()
        })),
        middleware: jest.fn()
      });
      const resultHandlerMock = { resultHandler: jest.fn() };
      const factory = new EndpointsFactory()
        .addMiddleware(middleware)
        .setResultHandler(resultHandlerMock as unknown as ResultHandlerDefinition<any, any>);
      const handlerMock = jest.fn().mockImplementation((params) => ({
        input: params.input,
        b: true,
      }));
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
      expect(endpoint['middlewares']).toStrictEqual([middleware]);
      expect(endpoint['inputSchema'].shape).toMatchSnapshot();
      expect(endpoint['outputSchema'].shape).toMatchSnapshot();
      expect(endpoint['handler']).toStrictEqual(handlerMock);
      expect(endpoint['resultHandler']).toStrictEqual(resultHandlerMock);
      expectType<({
        n1: z.ZodNumber,
      } | {
        n2: z.ZodNumber,
      }) & {
        s: z.ZodString,
      }>(endpoint['inputSchema'].shape);
      expectType<{
        n1?: z.ZodNumber,
        n2?: z.ZodNumber,
        s: z.ZodString,
      }>(endpoint['inputSchema'].shape);
    });
  });
});
