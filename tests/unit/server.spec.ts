import http from 'http';

let appMock: ReturnType<typeof newAppMock>;
const expressJsonMock = jest.fn();
const newAppMock = () => ({
  use: jest.fn(),
  listen: jest.fn((port, cb) => {cb && cb(); return new http.Server(); }),
  get: jest.fn(),
  post: jest.fn(),
  options: jest.fn()
});

const expressMock = jest.mock('express', () => {
  appMock = newAppMock();
  const returnFunction = () => appMock;
  returnFunction.json = () => expressJsonMock;
  return returnFunction;
});

import express from 'express'; // mocked above
import {createServer, attachRouting, EndpointsFactory, z, defaultResultHandler} from '../../src';
import {AppConfig, CommonConfig, ServerConfig} from '../../src/config-type';

describe('Server', () => {
  beforeEach(() => {
    appMock = newAppMock();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  test('Express is mocked', () => {
    expect(expressMock).toBeTruthy();
  });

  describe('createServer()', () => {
    test('Should create server with minimal config', () => {
      const configMock: ServerConfig & CommonConfig = {
        server: {
          listen: 8054,
        },
        cors: true,
        logger: {
          level: 'warn',
          color: false
        }
      };
      const routingMock = {
        v1: {
          test: new EndpointsFactory(defaultResultHandler)
            .build({
              methods: ['get', 'post'],
              input: z.object({
                n: z.number()
              }),
              output: z.object({
                b: z.boolean()
              }),
              handler: jest.fn()
            })
        }
      };
      createServer(configMock, routingMock);
      expect(appMock).toBeTruthy();
      expect(appMock.use).toBeCalledTimes(3);
      expect(Array.isArray(appMock.use.mock.calls[0][0])).toBeTruthy();
      expect(appMock.use.mock.calls[0][0][0]).toBe(expressJsonMock);
      expect(appMock.get).toBeCalledTimes(1);
      expect(appMock.get.mock.calls[0][0]).toBe('/v1/test');
      expect(appMock.post).toBeCalledTimes(1);
      expect(appMock.post.mock.calls[0][0]).toBe('/v1/test');
      expect(appMock.options).toBeCalledTimes(1);
      expect(appMock.options.mock.calls[0][0]).toBe('/v1/test');
      expect(appMock.listen).toBeCalledTimes(1);
      expect(appMock.listen.mock.calls[0][0]).toBe(8054);
    });

    test('Should create server with custom JSON parser, logger and error handler', () => {
      const configMock = {
        server: {
          listen: 8054,
          jsonParser: jest.fn(),
        },
        cors: true,
        errorHandler: {
          handler: jest.fn(),
        },
        logger: {
          info: jest.fn()
        }
      };
      const routingMock = {
        v1: {
          test: new EndpointsFactory(defaultResultHandler)
            .build({
              methods: ['get', 'post'],
              input: z.object({
                n: z.number()
              }),
              output: z.object({
                b: z.boolean()
              }),
              handler: jest.fn()
            })
        }
      };
      const server = createServer(configMock as unknown as ServerConfig & CommonConfig, routingMock);
      expect(server).toBeInstanceOf(http.Server);
      expect(appMock).toBeTruthy();
      expect(appMock.use).toBeCalledTimes(3);
      expect(Array.isArray(appMock.use.mock.calls[0][0])).toBeTruthy();
      expect(appMock.use.mock.calls[0][0][0]).toBe(configMock.server.jsonParser);
      expect(typeof appMock.use.mock.calls[2][0]).toBe('function');
      expect(configMock.errorHandler.handler).toBeCalledTimes(0);
      appMock.use.mock.calls[2][0]({method: 'get', path: '/v1/test'});
      expect(configMock.errorHandler.handler).toBeCalledTimes(1);
      expect(configMock.logger.info).toBeCalledTimes(1);
      expect(configMock.logger.info).toBeCalledWith('Listening 8054');
      expect(appMock.get).toBeCalledTimes(1);
      expect(appMock.get.mock.calls[0][0]).toBe('/v1/test');
      expect(appMock.post).toBeCalledTimes(1);
      expect(appMock.post.mock.calls[0][0]).toBe('/v1/test');
      expect(appMock.options).toBeCalledTimes(1);
      expect(appMock.options.mock.calls[0][0]).toBe('/v1/test');
      expect(appMock.listen).toBeCalledTimes(1);
      expect(appMock.listen.mock.calls[0][0]).toBe(8054);
    });

    test('parserFailureHandler should call next if there is no error', () => {
      const configMock: ServerConfig & CommonConfig = {
        server: {
          listen: 8054,
        },
        cors: true,
        logger: {
          level: 'warn',
          color: false
        }
      };
      const routingMock = {
        v1: {
          test: new EndpointsFactory(defaultResultHandler)
            .build({
              method: 'get',
              input: z.object({}),
              output: z.object({}),
              handler: jest.fn()
            })
        }
      };
      createServer(configMock, routingMock);
      expect(appMock).toBeTruthy();
      expect(appMock.use).toBeCalledTimes(3);
      expect(typeof appMock.use.mock.calls[1][0]).toBe('function');
      const next = jest.fn();
      appMock.use.mock.calls[1][0](undefined, null, null, next);
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('attachRouting()', () => {
    test('should attach routing to the custom express app', () => {
      const app = express();
      expect(appMock).toBeTruthy();
      const configMock = {
        app,
        cors: true,
        errorHandler: {
          handler: jest.fn(),
        },
        logger: {
          info: jest.fn()
        }
      };
      const routingMock = {
        v1: {
          test: new EndpointsFactory(defaultResultHandler)
            .build({
              methods: ['get', 'post'],
              input: z.object({
                n: z.number()
              }),
              output: z.object({
                b: z.boolean()
              }),
              handler: jest.fn()
            })
        }
      };
      // noinspection JSVoidFunctionReturnValueUsed
      const result = attachRouting(configMock as unknown as AppConfig & CommonConfig, routingMock);
      expect(result).toBe(undefined);
      expect(appMock.use).toBeCalledTimes(0);
      expect(configMock.errorHandler.handler).toBeCalledTimes(0);
      expect(configMock.logger.info).toBeCalledTimes(0);
      expect(appMock.listen).toBeCalledTimes(0);
      expect(appMock.get).toBeCalledTimes(1);
      expect(appMock.get.mock.calls[0][0]).toBe('/v1/test');
      expect(appMock.post).toBeCalledTimes(1);
      expect(appMock.post.mock.calls[0][0]).toBe('/v1/test');
      expect(appMock.options).toBeCalledTimes(1);
      expect(appMock.options.mock.calls[0][0]).toBe('/v1/test');
      app.listen(8054);
      expect(appMock.listen).toBeCalledTimes(1);
      expect(appMock.listen.mock.calls[0][0]).toBe(8054);
    });
  });
});
