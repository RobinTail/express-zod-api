let appMock: ReturnType<typeof newAppMock>;
const expressJsonMock = jest.fn();
const newAppMock = () => ({
  use: jest.fn(),
  listen: jest.fn(),
  get: jest.fn(),
  post: jest.fn()
});

const expressMock = jest.mock('express', () => {
  appMock = newAppMock();
  const returnFunction = () => appMock;
  returnFunction.json = () => expressJsonMock;
  return returnFunction;
});

import {ConfigType, createServer, EndpointsFactory, z} from '../../src';

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
      const configMock: ConfigType = {
        server: {
          listen: 8054,
          cors: true
        },
        logger: {
          level: 'warn',
          color: false
        }
      };
      const routingMock = {
        v1: {
          test: new EndpointsFactory().build({
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
      expect(appMock.use).toBeCalledTimes(2);
      expect(Array.isArray(appMock.use.mock.calls[0][0])).toBeTruthy();
      expect(appMock.use.mock.calls[0][0][0]).toBe(expressJsonMock);
      expect(appMock.get).toBeCalledTimes(1);
      expect(appMock.get.mock.calls[0][0]).toBe('/v1/test');
      expect(appMock.post).toBeCalledTimes(1);
      expect(appMock.post.mock.calls[0][0]).toBe('/v1/test');
      expect(appMock.listen).toBeCalledTimes(1);
      expect(appMock.listen.mock.calls[0][0]).toBe(8054);
    });

    test('Should create server with custom JSON parser and result handler', () => {
      const configMock: ConfigType = {
        server: {
          listen: 8054,
          cors: true,
          jsonParser: jest.fn(),
          resultHandler: jest.fn()
        },
        logger: {
          level: 'warn',
          color: false
        }
      };
      const routingMock = {
        v1: {
          test: new EndpointsFactory().build({
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
      expect(appMock.use).toBeCalledTimes(2);
      expect(Array.isArray(appMock.use.mock.calls[0][0])).toBeTruthy();
      expect(appMock.use.mock.calls[0][0][0]).toBe(configMock.server.jsonParser);
      expect(typeof appMock.use.mock.calls[1][0]).toBe('function');
      expect(configMock.server.resultHandler).toBeCalledTimes(0);
      appMock.use.mock.calls[1][0]({method: 'get', path: '/v1/test'});
      expect(configMock.server.resultHandler).toBeCalledTimes(1);
      expect(appMock.get).toBeCalledTimes(1);
      expect(appMock.get.mock.calls[0][0]).toBe('/v1/test');
      expect(appMock.post).toBeCalledTimes(1);
      expect(appMock.post.mock.calls[0][0]).toBe('/v1/test');
      expect(appMock.listen).toBeCalledTimes(1);
      expect(appMock.listen.mock.calls[0][0]).toBe(8054);
    });
  });
});
