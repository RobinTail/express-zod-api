import {
  z,
  EndpointsFactory,
  createMiddleware,
  defaultResultHandler,
  defaultEndpointsFactory,
  createResultHandler,
  createApiResponse,
  testEndpoint,
} from "../../src";
import { Endpoint } from "../../src/endpoint";
import { mimeJson } from "../../src/mime";
import { serializeSchemaForTest } from "../helpers";

describe("Endpoint", () => {
  describe(".getMethods()", () => {
    test("Should return the correct set of methods", () => {
      const endpointMock = new Endpoint({
        methods: ["get", "post", "put", "delete", "patch"],
        inputSchema: z.object({}),
        mimeTypes: [mimeJson],
        outputSchema: z.object({}),
        handler: jest.fn(),
        resultHandler: {
          getPositiveResponse: jest.fn(),
          getNegativeResponse: jest.fn(),
          handler: jest.fn(),
        },
        middlewares: [],
      });
      expect(endpointMock.getMethods()).toEqual([
        "get",
        "post",
        "put",
        "delete",
        "patch",
      ]);
    });

    test("Should return the array for a single method also", () => {
      const endpointMock = new Endpoint({
        method: "patch",
        inputSchema: z.object({}),
        mimeTypes: [mimeJson],
        outputSchema: z.object({}),
        handler: jest.fn(),
        resultHandler: {
          getPositiveResponse: jest.fn(),
          getNegativeResponse: jest.fn(),
          handler: jest.fn(),
        },
        middlewares: [],
      });
      expect(endpointMock.getMethods()).toEqual(["patch"]);
    });
  });

  describe(".execute()", () => {
    test("Should call middlewares, handler and resultHandler with correct arguments", async () => {
      const middlewareMock = jest
        .fn()
        .mockImplementationOnce(async ({ input }) => ({
          inc: input.n + 1,
        }));
      const middlewareDefinitionMock = createMiddleware({
        input: z.object({
          n: z.number(),
        }),
        middleware: middlewareMock,
      });
      const factory = new EndpointsFactory(defaultResultHandler).addMiddleware(
        middlewareDefinitionMock
      );
      const handlerMock = jest
        .fn()
        .mockImplementationOnce(async ({ input, options }) => ({
          inc2: (options as { inc: number }).inc + 1,
          str: input.n.toFixed(2),
          transform: "test",
        }));
      const endpoint = factory.build({
        methods: ["post"],
        input: z.object({
          n: z.number(),
        }),
        output: z.object({
          inc2: z.number(),
          str: z.string(),
          transform: z.string().transform((str) => str.length),
        }),
        handler: handlerMock,
      });
      const { requestMock, responseMock, loggerMock } = await testEndpoint({
        endpoint,
        requestProps: {
          method: "POST",
          body: { n: 453 },
        },
      });
      expect(middlewareMock).toBeCalledTimes(1);
      expect(middlewareMock).toBeCalledWith({
        input: { n: 453 },
        options: {
          inc: 454, // due to reassignment of options
        },
        request: requestMock,
        response: responseMock,
        logger: loggerMock,
      });
      expect(handlerMock).toBeCalledTimes(1);
      expect(handlerMock).toBeCalledWith({
        input: { n: 453 },
        options: { inc: 454 },
        logger: loggerMock,
      });
      expect(loggerMock.error).toBeCalledTimes(0);
      expect(responseMock.status).toBeCalledWith(200);
      expect(responseMock.json).toBeCalledWith({
        status: "success",
        data: {
          inc2: 455,
          str: "453.00",
          transform: 4,
        },
      });
    });

    test("should close the stream on OPTIONS request", async () => {
      const handlerMock = jest.fn();
      const endpoint = defaultEndpointsFactory.build({
        method: "get",
        input: z.object({}),
        output: z.object({}),
        handler: handlerMock,
      });
      const { responseMock, loggerMock } = await testEndpoint({
        endpoint,
        requestProps: {
          method: "OPTIONS",
        },
        configProps: {
          cors: ({ defaultHeaders }) => ({
            ...defaultHeaders,
            "X-Custom-Header": "Testing",
          }),
        },
      });
      expect(loggerMock.error).toBeCalledTimes(0);
      expect(responseMock.status).toBeCalledWith(200);
      expect(responseMock.json).toBeCalledTimes(0);
      expect(handlerMock).toBeCalledTimes(0);
      expect(responseMock.set).toBeCalledTimes(4);
      expect(responseMock.end).toBeCalledTimes(1);
      expect(responseMock.set.mock.calls[0]).toEqual([
        "Access-Control-Allow-Origin",
        "*",
      ]);
      expect(responseMock.set.mock.calls[1]).toEqual([
        "Access-Control-Allow-Methods",
        "GET, OPTIONS",
      ]);
      expect(responseMock.set.mock.calls[2]).toEqual([
        "Access-Control-Allow-Headers",
        "content-type",
      ]);
      expect(responseMock.set.mock.calls[3]).toEqual([
        "X-Custom-Header",
        "Testing",
      ]);
    });
  });

  describe("#parseOutput", () => {
    test("Should throw on output parsing non-Zod error", async () => {
      const factory = new EndpointsFactory(defaultResultHandler);
      const endpoint = factory.build({
        method: "post",
        input: z.object({}),
        output: z.object({
          test: z.number().transform(() => {
            throw new Error("Something unexpected");
          }),
        }),
        handler: async () => ({
          test: 123,
        }),
      });
      const { responseMock, loggerMock } = await testEndpoint({
        endpoint,
      });
      expect(loggerMock.error).toBeCalledTimes(1);
      expect(responseMock.status).toBeCalledWith(500);
      expect(responseMock.json).toBeCalledWith({
        status: "error",
        error: {
          message: "Something unexpected",
        },
      });
    });
  });

  describe("#runMiddlewares", () => {
    test("Should handle middleware closing the response stream", async () => {
      const middlewareMock = jest
        .fn()
        .mockImplementationOnce(async ({ input, response }) => {
          response.end("to hell with all that!");
          return { inc: input.n + 1 };
        });
      const middlewareDefinitionMock = createMiddleware({
        input: z.object({
          n: z.number(),
        }),
        middleware: middlewareMock,
      });
      const factory = defaultEndpointsFactory.addMiddleware(
        middlewareDefinitionMock
      );
      const handlerMock = jest.fn();
      const endpoint = factory.build({
        method: "post",
        input: z.object({}),
        output: z.object({}),
        handler: handlerMock,
      });
      const { responseMock, loggerMock } = await testEndpoint({
        endpoint,
        requestProps: {
          method: "POST",
          body: { n: 453 },
        },
      });
      expect(handlerMock).toHaveBeenCalledTimes(0);
      expect(middlewareMock).toHaveBeenCalledTimes(1);
      expect(loggerMock.error).toBeCalledTimes(0);
      expect(loggerMock.warn).toBeCalledTimes(1);
      expect(loggerMock.warn.mock.calls[0][0]).toBe(
        "The middleware mockConstructor has closed the stream. Accumulated options:"
      );
      expect(loggerMock.warn.mock.calls[0][1]).toEqual({ inc: 454 });
      expect(responseMock.status).toBeCalledTimes(0);
      expect(responseMock.json).toBeCalledTimes(0);
      expect(responseMock.statusCode).toBe(200);
      expect(responseMock.statusMessage).toBe("OK");
    });
  });

  describe("#handleResult", () => {
    test("Should handle errors within ResultHandler", async () => {
      const factory = new EndpointsFactory(
        createResultHandler({
          getPositiveResponse: () => createApiResponse(z.object({})),
          getNegativeResponse: () => createApiResponse(z.object({})),
          handler: () => {
            throw new Error("Something unexpected happened");
          },
        })
      );
      const endpoint = factory.build({
        method: "get",
        input: z.object({}),
        output: z.object({
          test: z.string(),
        }),
        handler: async () => ({ test: "OK" }),
      });
      const { loggerMock, responseMock } = await testEndpoint({ endpoint });
      expect(loggerMock.error).toBeCalledTimes(1);
      expect(loggerMock.error.mock.calls[0][0]).toBe(
        "Result handler failure: Something unexpected happened."
      );
      expect(responseMock.status).toBeCalledTimes(1);
      expect(responseMock.status.mock.calls[0][0]).toBe(500);
      expect(responseMock.json).toBeCalledTimes(0);
      expect(responseMock.end).toBeCalledTimes(1);
      expect(responseMock.end.mock.calls[0][0]).toBe(
        "An error occurred while serving the result: Something unexpected happened."
      );
    });
  });

  describe(".getInputSchema()", () => {
    test("should return input schema", () => {
      const factory = new EndpointsFactory(defaultResultHandler);
      const input = z.object({
        something: z.number(),
      });
      const endpoint = factory.build({
        method: "get",
        input,
        output: z.object({}),
        handler: jest.fn(),
      });
      expect(endpoint.getInputSchema()).toEqual(input);
    });
  });

  describe(".getOutputSchema()", () => {
    test("should return output schema", () => {
      const factory = new EndpointsFactory(defaultResultHandler);
      const output = z.object({
        something: z.number(),
      });
      const endpoint = factory.build({
        method: "get",
        input: z.object({}),
        output,
        handler: jest.fn(),
      });
      expect(endpoint.getOutputSchema()).toEqual(output);
    });
  });

  describe(".getPositiveResponseSchema()", () => {
    test("should return schema according to the result handler", () => {
      const factory = new EndpointsFactory(defaultResultHandler);
      const output = z.object({
        something: z.number(),
      });
      const endpoint = factory.build({
        method: "get",
        input: z.object({}),
        output,
        handler: jest.fn(),
      });
      expect(
        serializeSchemaForTest(endpoint.getPositiveResponseSchema())
      ).toMatchSnapshot();
    });
  });

  describe(".getNegativeResponseSchema()", () => {
    test("should return the negative schema of the result handler", () => {
      const factory = new EndpointsFactory(defaultResultHandler);
      const output = z.object({
        something: z.number(),
      });
      const endpoint = factory.build({
        method: "get",
        input: z.object({}),
        output,
        handler: jest.fn(),
      });
      expect(
        serializeSchemaForTest(endpoint.getNegativeResponseSchema())
      ).toMatchSnapshot();
    });
  });

  describe(".getPositiveMimeTypes()", () => {
    test("should return an array according to the result handler", () => {
      const factory = new EndpointsFactory(defaultResultHandler);
      const endpoint = factory.build({
        method: "get",
        input: z.object({}),
        output: z.object({}),
        handler: jest.fn(),
      });
      expect(endpoint.getPositiveMimeTypes()).toEqual(["application/json"]);
    });
  });

  describe(".getNegativeMimeTypes()", () => {
    test("should return an array according to the result handler", () => {
      const factory = new EndpointsFactory(defaultResultHandler);
      const endpoint = factory.build({
        method: "get",
        input: z.object({}),
        output: z.object({}),
        handler: jest.fn(),
      });
      expect(endpoint.getNegativeMimeTypes()).toEqual(["application/json"]);
    });
  });

  describe("Issue #269: Async refinements", () => {
    test("should handle async refinements in input, output and middleware", async () => {
      const endpoint = new EndpointsFactory(defaultResultHandler)
        .addMiddleware(
          createMiddleware({
            input: z.object({
              m: z.number().refine(async (m) => m < 10),
            }),
            middleware: async () => ({}),
          })
        )
        .build({
          methods: ["post"],
          input: z.object({
            n: z.number().refine(async (n) => n > 100),
          }),
          output: z.object({
            str: z.string().refine(async (str) => str.length > 3),
          }),
          handler: async () => ({
            str: "This is fine",
          }),
        });
      const { responseMock } = await testEndpoint({
        endpoint,
        requestProps: {
          method: "POST",
          body: { n: 123, m: 5 },
        },
      });
      expect(responseMock.json).toHaveBeenCalledWith({
        status: "success",
        data: {
          str: "This is fine",
        },
      });
    });
  });

  describe("Issue #514: Express native middlewares for OPTIONS request", () => {
    test("should skip proprietary ones", async () => {
      const endpoint = new EndpointsFactory(defaultResultHandler)
        .addMiddleware(
          createMiddleware({
            input: z.object({
              shouldNotBeHere: z.boolean(),
            }),
            middleware: async () => {
              throw new Error("Should not be here");
            },
          })
        )
        .addExpressMiddleware((req, res, next) => {
          res.set("X-Custom-Header", "test");
          next();
        })
        .build({
          methods: ["post"],
          input: z.object({
            shouldNotBeThere: z.boolean(),
          }),
          output: z.object({
            shouldNotComeHereAsWell: z.boolean(),
          }),
          handler: async () => ({ shouldNotComeHereAsWell: true }),
        });
      const { responseMock } = await testEndpoint({
        endpoint,
        requestProps: {
          method: "OPTIONS",
        },
      });
      expect(responseMock.status).toHaveBeenCalledWith(200);
      expect(responseMock.json).toHaveBeenCalledTimes(0);
      expect(responseMock.set).toHaveBeenCalledWith("X-Custom-Header", "test");
    });
  });

  describe("Issue #585: Handling non-Error exceptions", () => {
    test("thrown in #parseOutput()", async () => {
      const factory = new EndpointsFactory(defaultResultHandler);
      const endpoint = factory.build({
        method: "post",
        input: z.object({}),
        output: z.object({
          test: z.number().transform(() => {
            // eslint-disable-next-line @typescript-eslint/no-throw-literal
            throw "Something unexpected";
          }),
        }),
        handler: async () => ({
          test: 123,
        }),
      });
      const { responseMock, loggerMock } = await testEndpoint({
        endpoint,
      });
      expect(loggerMock.error).toBeCalledTimes(1);
      expect(responseMock.status).toBeCalledWith(500);
      expect(responseMock.json).toBeCalledWith({
        status: "error",
        error: {
          message: "Something unexpected",
        },
      });
    });

    test("thrown in #handleResult()", async () => {
      const factory = new EndpointsFactory(
        createResultHandler({
          getPositiveResponse: () => createApiResponse(z.object({})),
          getNegativeResponse: () => createApiResponse(z.object({})),
          handler: () => {
            // eslint-disable-next-line @typescript-eslint/no-throw-literal
            throw "Something unexpected happened";
          },
        })
      );
      const endpoint = factory.build({
        method: "get",
        input: z.object({}),
        output: z.object({
          test: z.string(),
        }),
        handler: async () => ({ test: "OK" }),
      });
      const { loggerMock, responseMock } = await testEndpoint({ endpoint });
      expect(loggerMock.error).toBeCalledTimes(1);
      expect(loggerMock.error.mock.calls[0][0]).toBe(
        "Result handler failure: Something unexpected happened."
      );
      expect(responseMock.status).toBeCalledTimes(1);
      expect(responseMock.status.mock.calls[0][0]).toBe(500);
      expect(responseMock.json).toBeCalledTimes(0);
      expect(responseMock.end).toBeCalledTimes(1);
      expect(responseMock.end.mock.calls[0][0]).toBe(
        "An error occurred while serving the result: Something unexpected happened."
      );
    });

    test("silence zod parse error option", async () => {
      const endpoint = defaultEndpointsFactory.build({
        method: "post",
        input: z.object({
          limit: z.preprocess(
            (a) => parseInt(z.string().parse(a), 10),
            z.number().positive().max(100)
          ),
        }),
        output: z.object({
          test: z.string(),
          limit: z.number(),
        }),
        handler: async ({ input: { limit } }) => ({ test: "OK", limit }),
      });
      const { responseMock } = await testEndpoint({
        endpoint,
        requestProps: {
          method: "POST",
          body: { limit: 1000 },
        },
        configProps: {
          isSilenceZodParseError: true,
          logger: { level: "debug", color: true },
        },
      });

      expect(responseMock.status).toBeCalledWith(200);
      expect(responseMock.json).toBeCalledWith({
        status: "success",
        data: { test: "OK", limit: 1000 },
      });
    });

    test("thrown in middleware and caught in execute()", async () => {
      const factory = new EndpointsFactory(defaultResultHandler).addMiddleware(
        createMiddleware({
          input: z.object({}),
          middleware: async () => {
            // eslint-disable-next-line @typescript-eslint/no-throw-literal
            throw "Something went wrong";
          },
        })
      );
      const endpoint = factory.build({
        methods: ["post"],
        input: z.object({}),
        output: z.object({}),
        handler: async () => ({}),
      });
      const { responseMock, loggerMock } = await testEndpoint({
        endpoint,
        requestProps: {
          method: "POST",
          body: {},
        },
      });
      expect(loggerMock.error).toBeCalledTimes(1);
      expect(responseMock.status).toBeCalledWith(500);
      expect(responseMock.json).toBeCalledWith({
        status: "error",
        error: { message: "Something went wrong" },
      });
    });
  });
});
