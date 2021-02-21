import {z, EndpointsFactory, ConfigType, createMiddleware} from '../src';
import {Endpoint} from '../src/endpoint';
import {Request, Response} from 'express';

let loggerMock: any;

beforeEach(() => {
  loggerMock = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
});

describe('Endpoint', () => {
  describe('.getMethods()', () => {
    test('Should return the correct set of methods', () => {
      const endpointMock = new Endpoint({
        methods: ['get', 'post', 'put', 'delete', 'patch'],
        inputSchema: z.object({}).nonstrict(),
        outputSchema: z.object({}).nonstrict(),
        handler: async () => ({}),
        resultHandler: () => {
        },
        middlewares: []
      });
      expect(endpointMock.getMethods()).toEqual(['get', 'post', 'put', 'delete', 'patch']);
    });
  });

  describe('.execute()', () => {
    test('Should call middlewares, handler and resultHandler with correct arguments', async () => {
      const middlewareMock = jest.fn().mockImplementationOnce(({input}) => Promise.resolve({
        inc: input.n + 1
      }));
      const middlewareDefinitionMock = createMiddleware({
        input: z.object({
          n: z.number()
        }),
        middleware: middlewareMock
      });
      const factory = new EndpointsFactory().addMiddleware(middlewareDefinitionMock);
      const handlerMock = jest.fn().mockImplementationOnce(({input, options}) => Promise.resolve({
        inc2: (options as { inc: number }).inc + 1,
        str: input.n.toFixed(2)
      }));
      const endpoint = factory.build({
        methods: ['post'],
        input: z.object({
          n: z.number(),
        }),
        output: z.object({
          inc2: z.number(),
          str: z.string()
        }),
        handler: handlerMock
      });
      const requestMock = {
        method: 'POST',
        body: {
          n: 453
        }
      };
      const responseMock = {
        set: jest.fn(),
        status: jest.fn(),
        json: jest.fn()
      };
      const configMock = {
        server: {
          cors: true
        }
      };
      await endpoint.execute({
        request: requestMock as Request,
        response: responseMock as any as Response,
        config: configMock as ConfigType,
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
          str: '453.00'
        }
      });
    });
  });
});
