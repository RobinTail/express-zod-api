import {z, EndpointsFactory, ConfigType, createMiddleware} from '../../src';
import {Endpoint} from '../../src/endpoint';
import {Request, Response} from 'express';
import {defaultResultHandler} from '../../src/result-handler';

let loggerMock: any;

describe('Endpoint', () => {
  beforeEach(() => {
    loggerMock = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };
  });

  describe('.getMethods()', () => {
    test('Should return the correct set of methods', () => {
      const endpointMock = new Endpoint({
        methods: ['get', 'post', 'put', 'delete', 'patch'],
        inputSchema: z.object({}).nonstrict(),
        outputSchema: z.object({}).nonstrict(),
        handler: jest.fn(),
        resultHandler: {
          getPositiveResponse: jest.fn(),
          getNegativeResponse: jest.fn(),
          resultHandler: jest.fn()
        },
        middlewares: []
      });
      expect(endpointMock.getMethods()).toEqual(['get', 'post', 'put', 'delete', 'patch']);
    });

    test('Should return the array for a single method also', () => {
      const endpointMock = new Endpoint({
        method: 'patch',
        inputSchema: z.object({}).nonstrict(),
        outputSchema: z.object({}).nonstrict(),
        handler: jest.fn(),
        resultHandler: {
          getPositiveResponse: jest.fn(),
          getNegativeResponse: jest.fn(),
          resultHandler: jest.fn()
        },
        middlewares: []
      });
      expect(endpointMock.getMethods()).toEqual(['patch']);
    });
  });

  describe('.execute()', () => {
    test('Should call middlewares, handler and resultHandler with correct arguments', async () => {
      const middlewareMock = jest.fn().mockImplementationOnce(async ({input}) => ({
        inc: input.n + 1
      }));
      const middlewareDefinitionMock = createMiddleware({
        input: z.object({
          n: z.number()
        }),
        middleware: middlewareMock
      });
      const factory = new EndpointsFactory(defaultResultHandler)
        .addMiddleware(middlewareDefinitionMock);
      const handlerMock = jest.fn().mockImplementationOnce(async ({input, options}) => ({
        inc2: (options as { inc: number }).inc + 1,
        str: input.n.toFixed(2),
        transform: 'test'
      }));
      const endpoint = factory.build({
        methods: ['post'],
        input: z.object({
          n: z.number(),
        }),
        output: z.object({
          inc2: z.number(),
          str: z.string(),
          transform: z.string().transform((str) => str.length)
        }),
        handler: handlerMock
      });
      const requestMock = {
        method: 'POST',
        body: {
          n: 453
        }
      };
      const responseMock: Record<string, jest.Mock> = {
        set: jest.fn().mockImplementation(() => responseMock),
        status: jest.fn().mockImplementation(() => responseMock),
        json: jest.fn().mockImplementation(() => responseMock)
      };
      const configMock = {
        server: {
          cors: true
        }
      };
      await endpoint.execute({
        request: requestMock as Request,
        response: responseMock as any as Response,
        config: configMock as unknown as ConfigType,
        logger: loggerMock
      });
      expect(middlewareMock).toBeCalledTimes(1);
      expect(middlewareMock).toBeCalledWith({
        input: {
          n: 453
        },
        options: {
          inc: 454 // due to reassignment of options
        },
        request: requestMock,
        response: responseMock,
        logger: loggerMock
      });
      expect(handlerMock).toBeCalledTimes(1);
      expect(handlerMock).toBeCalledWith({
        input: {
          n: 453,
        },
        options: {
          inc: 454
        },
        logger: loggerMock
      });
      expect(loggerMock.error).toBeCalledTimes(0);
      expect(responseMock.status).toBeCalledWith(200);
      expect(responseMock.json).toBeCalledWith({
        status: 'success',
        data: {
          inc2: 455,
          str: '453.00',
          transform: 4
        }
      });
    });
  });
});
