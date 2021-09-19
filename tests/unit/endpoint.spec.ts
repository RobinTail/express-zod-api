import http from 'http';
import {expectType} from 'tsd';
import {
  z,
  EndpointsFactory,
  createMiddleware,
  defaultResultHandler,
  EndpointInput,
  EndpointOutput,
  EndpointResponse,
  defaultEndpointsFactory,
  createResultHandler,
  createApiResponse
} from '../../src';
import {CommonConfig} from '../../src/config-type';
import {Endpoint} from '../../src/endpoint';
import {Request, Response} from 'express';
import {mimeJson} from '../../src/mime';
import {serializeSchemaForTest} from '../helpers';

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
        inputSchema: z.object({}),
        mimeTypes: [mimeJson],
        outputSchema: z.object({}),
        handler: jest.fn(),
        resultHandler: {
          getPositiveResponse: jest.fn(),
          getNegativeResponse: jest.fn(),
          handler: jest.fn()
        },
        middlewares: []
      });
      expect(endpointMock.getMethods()).toEqual(['get', 'post', 'put', 'delete', 'patch']);
    });

    test('Should return the array for a single method also', () => {
      const endpointMock = new Endpoint({
        method: 'patch',
        inputSchema: z.object({}),
        mimeTypes: [mimeJson],
        outputSchema: z.object({}),
        handler: jest.fn(),
        resultHandler: {
          getPositiveResponse: jest.fn(),
          getNegativeResponse: jest.fn(),
          handler: jest.fn()
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
        header: jest.fn(() => mimeJson),
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
        cors: true
      };
      await endpoint.execute({
        request: requestMock as unknown as Request,
        response: responseMock as unknown as Response,
        config: configMock as CommonConfig,
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

    test('should close the stream on OPTIONS request', async () => {
      const handlerMock = jest.fn();
      const endpoint = defaultEndpointsFactory.build({
        method: 'get',
        input: z.object({}),
        output: z.object({}),
        handler: handlerMock
      });
      const requestMock = {
        method: 'OPTIONS',
        header: jest.fn(() => mimeJson),
      };
      const responseMock: Record<string, jest.Mock> = {
        end: jest.fn(),
        set: jest.fn().mockImplementation(() => responseMock),
        status: jest.fn().mockImplementation(() => responseMock),
        json: jest.fn().mockImplementation(() => responseMock)
      };
      const configMock = {
        cors: true
      };
      await endpoint.execute({
        request: requestMock as unknown as Request,
        response: responseMock as unknown as Response,
        config: configMock as CommonConfig,
        logger: loggerMock
      });
      expect(loggerMock.error).toBeCalledTimes(0);
      expect(responseMock.status).toBeCalledTimes(0);
      expect(responseMock.json).toBeCalledTimes(0);
      expect(handlerMock).toBeCalledTimes(0);
      expect(responseMock.set).toBeCalledTimes(3);
      expect(responseMock.end).toBeCalledTimes(1);
      expect(responseMock.set.mock.calls[0]).toEqual(['Access-Control-Allow-Origin', '*']);
      expect(responseMock.set.mock.calls[1]).toEqual(['Access-Control-Allow-Methods', 'GET, OPTIONS']);
      expect(responseMock.set.mock.calls[2]).toEqual(['Access-Control-Allow-Headers', 'content-type']);
    });
  });

  describe('#parseOutput', () => {
    test('Should throw on output parsing non-Zod error', async () => {
      const factory = new EndpointsFactory(defaultResultHandler);
      const endpoint = factory.build({
        method: 'post',
        input: z.object({}),
        output: z.object({
          test: z.number().transform(() => {
            throw new Error('Something unexpected');
          })
        }),
        handler: async () => ({
          test: 123
        })
      });
      const requestMock = {
        method: 'GET',
        header: jest.fn(() => mimeJson),
        body: {}
      };
      const responseMock: Record<string, jest.Mock> = {
        set: jest.fn().mockImplementation(() => responseMock),
        status: jest.fn().mockImplementation(() => responseMock),
        json: jest.fn().mockImplementation(() => responseMock)
      };
      const configMock = {
        cors: true
      };
      await endpoint.execute({
        request: requestMock as unknown as Request,
        response: responseMock as unknown as Response,
        config: configMock as CommonConfig,
        logger: loggerMock
      });
      expect(loggerMock.error).toBeCalledTimes(1);
      expect(responseMock.status).toBeCalledWith(500);
      expect(responseMock.json).toBeCalledWith({
        status: 'error',
        error: {
          message: 'Something unexpected'
        }
      });
    });
  });

  describe('#runMiddlewares', () => {
    test('Should handle middleware closing the response stream', async () => {
      const middlewareMock = jest.fn().mockImplementationOnce(async ({input, response}) => {
        response.end('to hell with all that!');
        return { inc: input.n + 1 };
      });
      const middlewareDefinitionMock = createMiddleware({
        input: z.object({
          n: z.number()
        }),
        middleware: middlewareMock
      });
      const factory = defaultEndpointsFactory.addMiddleware(middlewareDefinitionMock);
      const handlerMock = jest.fn();
      const endpoint = factory.build({
        method: 'post',
        input: z.object({}),
        output: z.object({}),
        handler: handlerMock
      });
      const configMock = {
        cors: true
      };
      const requestMock = {
        method: 'POST',
        header: jest.fn(() => mimeJson),
        body: {
          n: 453
        }
      };
      const responseMock: any = new http.ServerResponse(requestMock as unknown as Request);
      responseMock.set = jest.fn().mockImplementation(() => responseMock);
      responseMock.status = jest.fn().mockImplementation(() => responseMock);
      responseMock.json = jest.fn().mockImplementation(() => responseMock);
      await endpoint.execute({
        request: requestMock as unknown as Request,
        response: responseMock as unknown as Response,
        config: configMock as CommonConfig,
        logger: loggerMock
      });
      expect(handlerMock).toHaveBeenCalledTimes(0);
      expect(middlewareMock).toHaveBeenCalledTimes(1);
      expect(loggerMock.error).toBeCalledTimes(0);
      expect(loggerMock.warn).toBeCalledTimes(1);
      expect(loggerMock.warn.mock.calls[0][0]).toBe(
        'The middleware mockConstructor has closed the stream. Accumulated options:'
      );
      expect(loggerMock.warn.mock.calls[0][1]).toEqual({inc: 454});
      expect(responseMock.status).toBeCalledTimes(0);
      expect(responseMock.json).toBeCalledTimes(0);
      expect(responseMock.statusCode).toBe(200);
      expect(responseMock.statusMessage).toBe('OK');
    });
  });

  describe('#handleResult', () => {
    test('Should handle errors within ResultHandler', async () => {
      const factory = new EndpointsFactory(createResultHandler({
        getPositiveResponse: () => createApiResponse(z.object({})),
        getNegativeResponse: () => createApiResponse(z.object({})),
        handler: () => {
          throw new Error('Something unexpected happened');
        }
      }));
      const endpoint = factory.build({
        method: 'get',
        input: z.object({}),
        output: z.object({
          test: z.string()
        }),
        handler: async () => ({test: 'OK'})
      });
      const requestMock = {
        method: 'GET',
        header: jest.fn(() => mimeJson),
      };
      const responseMock: Record<string, jest.Mock> = {
        set: jest.fn().mockImplementation(() => responseMock),
        status: jest.fn().mockImplementation(() => responseMock),
        json: jest.fn().mockImplementation(() => responseMock)
      };
      const configMock = {
        cors: true
      };
      await endpoint.execute({
        request: requestMock as unknown as Request,
        response: responseMock as unknown as Response,
        config: configMock as CommonConfig,
        logger: loggerMock
      });
      expect(loggerMock.error).toBeCalledTimes(1);
      expect(loggerMock.error.mock.calls[0][0]).toBe('Result handler failure: Something unexpected happened.');
      expect(responseMock.status).toBeCalledTimes(0);
      expect(responseMock.json).toBeCalledTimes(0);
    });
  });

  describe('.getInputSchema()', () => {
    test('should return input schema', () => {
      const factory = new EndpointsFactory(defaultResultHandler);
      const input = z.object({
        something: z.number()
      });
      const endpoint = factory.build({
        method: 'get',
        input,
        output: z.object({}),
        handler: jest.fn()
      });
      expect(endpoint.getInputSchema()).toEqual(input);
    });
  });
  
  describe('.getOutputSchema()', () => {
    test('should return output schema', () => {
      const factory = new EndpointsFactory(defaultResultHandler);
      const output = z.object({
        something: z.number()
      });
      const endpoint = factory.build({
        method: 'get',
        input: z.object({}),
        output,
        handler: jest.fn()
      });
      expect(endpoint.getOutputSchema()).toEqual(output);
    });
  });
  
  describe('.getPositiveResponseSchema()', () => {
    test('should return schema according to the result handler', () => {
      const factory = new EndpointsFactory(defaultResultHandler);
      const output = z.object({
        something: z.number()
      });
      const endpoint = factory.build({
        method: 'get',
        input: z.object({}),
        output,
        handler: jest.fn()
      });
      expect(serializeSchemaForTest(endpoint.getPositiveResponseSchema())).toMatchSnapshot();
    });
  });

  describe('.getNegativeResponseSchema()', () => {
    test('should return the negative schema of the result handler', () => {
      const factory = new EndpointsFactory(defaultResultHandler);
      const output = z.object({
        something: z.number()
      });
      const endpoint = factory.build({
        method: 'get',
        input: z.object({}),
        output,
        handler: jest.fn()
      });
      expect(serializeSchemaForTest(endpoint.getNegativeResponseSchema())).toMatchSnapshot();
    });
  });

  describe('.getPositiveMimeTypes()', () => {
    test('should return an array according to the result handler', () => {
      const factory = new EndpointsFactory(defaultResultHandler);
      const endpoint = factory.build({
        method: 'get',
        input: z.object({}),
        output: z.object({}),
        handler: jest.fn()
      });
      expect(endpoint.getPositiveMimeTypes()).toEqual(['application/json']);
    });
  });

  describe('.getNegativeMimeTypes()', () => {
    test('should return an array according to the result handler', () => {
      const factory = new EndpointsFactory(defaultResultHandler);
      const endpoint = factory.build({
        method: 'get',
        input: z.object({}),
        output: z.object({}),
        handler: jest.fn()
      });
      expect(endpoint.getNegativeMimeTypes()).toEqual(['application/json']);
    });
  });

  describe('EndpointInput<>', () => {
    test('should be the type of input schema before transformations', () => {
      const factory = new EndpointsFactory(defaultResultHandler);
      const input = z.object({
        something: z.number().transform((value) => `${value}`)
      });
      const endpoint = factory.build({
        method: 'get',
        input,
        output: z.object({}),
        handler: jest.fn()
      });
      expectType<EndpointInput<typeof endpoint>>(input._input);
    });

    test('should also include inputs of middlewares', () => {
      const mInput = z.object({
        key: z.string()
      });
      const factory = new EndpointsFactory(defaultResultHandler).addMiddleware({
        input: mInput,
        middleware: jest.fn()
      });
      const input = z.object({
        something: z.number().transform((value) => `${value}`)
      });
      const mInput2 = z.object({
        token: z.string()
      });
      const endpoint = factory.addMiddleware({
        input: mInput2,
        middleware: jest.fn()
      }).build({
        method: 'get',
        input,
        output: z.object({}),
        handler: jest.fn()
      });
      expectType<EndpointInput<typeof endpoint>>({
        ...input._input,
        ...mInput._input,
        ...mInput2._input
      });
    });
  });

  describe('EndpointOutput<>', () => {
    test('should be the type of output schema after transformations', () => {
      const factory = new EndpointsFactory(defaultResultHandler);
      const output = z.object({
        something: z.number().transform((value) => `${value}`)
      });
      const endpoint = factory.build({
        method: 'get',
        input: z.object({}),
        output,
        handler: jest.fn()
      });
      expectType<EndpointOutput<typeof endpoint>>(output._output);
    });
  });

  describe('EndpointResponse<>', () => {
    test('should be the type declared in the result handler including positive and negative ones', () => {
      const factory = new EndpointsFactory(defaultResultHandler);
      const output = z.object({
        something: z.number().transform((value) => `${value}`)
      });
      const endpoint = factory.build({
        method: 'get',
        input: z.object({}),
        output,
        handler: jest.fn()
      });
      expectType<EndpointResponse<typeof endpoint>>({
        status: 'success',
        data: output._output
      });
      expectType<EndpointResponse<typeof endpoint>>({
        status: 'error',
        error: {
          message: 'some error'
        }
      });
    });
  });
});
