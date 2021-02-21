import {Express} from 'express';
import {Logger} from 'winston';
import {EndpointsFactory, z, Routing, initRouting, ConfigType} from '../src';

describe('initRouting()', () => {
  test('Should set right methods', () => {
    const appMock = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      patch: jest.fn()
    };
    const handlerMock = jest.fn();
    const loggerMock = jest.fn();
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
      app: appMock as any as Express,
      logger: loggerMock as any as Logger,
      config: configMock as any as ConfigType,
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
});
