import {Express, RequestHandler, Request, Response} from 'express';
import {Logger} from 'winston';
import {EndpointsFactory, z, Routing, ConfigType, DependsOnMethod} from '../../src';
import {initRouting} from '../../src/routing';

let appMock: any;
let loggerMock: any;

describe('Routing', () => {
  describe('initRouting()', () => {
    beforeEach(() => {
      appMock = {
        get: jest.fn(),
        post: jest.fn(),
        put: jest.fn(),
        delete: jest.fn(),
        patch: jest.fn()
      };

      loggerMock = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
      };
    });

    test('Should set right methods', () => {
      const handlerMock = jest.fn();
      const configMock = {};
      const getEndpoint = new EndpointsFactory().build({
        methods: ['get'],
        input: z.object({}).nonstrict(),
        output: z.object({}).nonstrict(),
        handler: handlerMock
      });
      const postEndpoint = new EndpointsFactory().build({
        methods: ['post'],
        input: z.object({}).nonstrict(),
        output: z.object({}).nonstrict(),
        handler: handlerMock
      });
      const getAndPostEndpoint = new EndpointsFactory().build({
        methods: ['get', 'post'],
        input: z.object({}).nonstrict(),
        output: z.object({}).nonstrict(),
        handler: handlerMock
      });
      const routing: Routing = {
        v1: {
          user: {
            get: getEndpoint,
            set: postEndpoint,
            universal: getAndPostEndpoint
          }
        }
      };
      initRouting({
        app: appMock as Express,
        logger: loggerMock as Logger,
        config: configMock as ConfigType,
        routing: routing
      });
      expect(appMock.get).toBeCalledTimes(2);
      expect(appMock.post).toBeCalledTimes(2);
      expect(appMock.put).toBeCalledTimes(0);
      expect(appMock.delete).toBeCalledTimes(0);
      expect(appMock.patch).toBeCalledTimes(0);
      expect(appMock.get.mock.calls[0][0]).toBe('/v1/user/get');
      expect(appMock.get.mock.calls[1][0]).toBe('/v1/user/universal');
      expect(appMock.post.mock.calls[0][0]).toBe('/v1/user/set');
      expect(appMock.post.mock.calls[1][0]).toBe('/v1/user/universal');
    });

    test('Should execute endpoints with right arguments', async () => {
      const handlerMock = jest.fn().mockImplementationOnce(() => ({result: true}));
      const configMock = { cors: true };
      const setEndpoint = new EndpointsFactory().build({
        methods: ['post'],
        input: z.object({
          test: z.number()
        }),
        output: z.object({
          result: z.boolean()
        }),
        handler: handlerMock
      });
      const routing: Routing = {
        v1: {
          user: {
            set: setEndpoint,
          }
        }
      };
      initRouting({
        app: appMock as Express,
        logger: loggerMock as Logger,
        config: configMock as ConfigType,
        routing: routing
      });
      expect(appMock.post).toBeCalledTimes(1);
      const routeHandler = appMock.post.mock.calls[0][1] as RequestHandler;
      const requestMock = {
        method: 'POST',
        body: {
          test: 123
        }
      };
      const responseMock: Record<string, jest.Mock> = {
        set: jest.fn().mockImplementation(() => responseMock),
        status: jest.fn().mockImplementation(() => responseMock),
        json: jest.fn().mockImplementation(() => responseMock)
      };
      const nextMock = jest.fn();
      await routeHandler(requestMock as Request, responseMock as any as Response, nextMock);
      expect(nextMock).toBeCalledTimes(0);
      expect(handlerMock).toBeCalledTimes(1);
      expect(loggerMock.info).toBeCalledWith('POST: /v1/user/set');
      expect(loggerMock.error).toBeCalledTimes(0);
      expect(handlerMock).toBeCalledWith({
        input: {
          test: 123,
        },
        options: {},
        logger: loggerMock
      });
      expect(responseMock.status).toBeCalledWith(200);
      expect(responseMock.json).toBeCalledWith({
        status: 'success',
        data: {
          result: true
        }
      });
    });
  });

  describe('DependsOnMethod', () => {
    test('should accept empty object', () => {
      const instance = new DependsOnMethod({});
      expect(instance).toBeInstanceOf(DependsOnMethod);
      expect(instance.methods).toEqual({});
    });

    test('should accept an endpoint with a corresponding method', () => {
      const instance = new DependsOnMethod({
        post: new EndpointsFactory().build({
          method: 'post',
          input: z.object({}),
          output: z.object({}),
          handler: async () => ({})
        })
      });
      expect(instance).toBeInstanceOf(DependsOnMethod);
      expect(instance.methods).toHaveProperty('post');
    });

    test('should accept an endpoint with additional methods', () => {
      const endpoint = new EndpointsFactory().build({
        methods: ['get', 'post'],
        input: z.object({}),
        output: z.object({}),
        handler: async () => ({})
      });
      const instance = new DependsOnMethod({
        get: endpoint,
        post: endpoint
      });
      expect(instance).toBeInstanceOf(DependsOnMethod);
      expect(instance.methods).toHaveProperty('get');
      expect(instance.methods).toHaveProperty('post');
    });

    test('should throw an error if the endpoint does not have the corresponding method', () => {
      const endpoint = new EndpointsFactory().build({
        methods: ['get', 'patch'],
        input: z.object({}),
        output: z.object({}),
        handler: async () => ({})
      });
      expect(() => new DependsOnMethod({
        get: endpoint,
        post: endpoint
      })).toThrowErrorMatchingSnapshot();
    });
  });
});
