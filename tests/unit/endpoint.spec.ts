import {expectType} from 'tsd';
import {
  z,
  EndpointsFactory,
  createMiddleware,
  defaultResultHandler,
  EndpointInput,
  EndpointOutput,
  EndpointResponse
} from '../../src';
import {CommonConfig} from '../../src/config-type';
import {Endpoint} from '../../src/endpoint';
import {Request, Response} from 'express';

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
        request: requestMock as Request,
        response: responseMock as any as Response,
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
      expect(JSON.stringify(endpoint.getPositiveResponseSchema())).toBe(JSON.stringify(
        z.object({
          status: z.literal('success'),
          data: output
        }))
      );
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
      expect(JSON.stringify(endpoint.getNegativeResponseSchema())).toBe(JSON.stringify(
        z.object({
          status: z.literal('error'),
          error: z.object({
            message: z.string(),
          })
        }))
      );
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
