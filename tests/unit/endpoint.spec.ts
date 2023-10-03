import { z } from "zod";
import {
  EndpointsFactory,
  createMiddleware,
  createResultHandler,
  defaultEndpointsFactory,
  defaultResultHandler,
  ez,
  testEndpoint,
} from "../../src";
import { Endpoint } from "../../src/endpoint";
import { IOSchemaError } from "../../src/errors";
import { serializeSchemaForTest } from "../helpers";

describe("Endpoint", () => {
  describe(".getMethods()", () => {
    test("Should return the correct set of methods", () => {
      const endpointMock = new Endpoint({
        methods: ["get", "post", "put", "delete", "patch"],
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        handler: jest.fn(),
        resultHandler: createResultHandler({
          getPositiveResponse: () => z.string(),
          getNegativeResponse: () => z.string(),
          handler: jest.fn(),
        }),
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
        methods: ["patch"],
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        handler: jest.fn(),
        resultHandler: createResultHandler({
          getPositiveResponse: () => z.string(),
          getNegativeResponse: () => z.string(),
          handler: jest.fn(),
        }),
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
        middlewareDefinitionMock,
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
    test("Should throw on output validation failure", async () => {
      const endpoint = defaultEndpointsFactory.build({
        method: "post",
        input: z.object({}),
        output: z.object({ email: z.string().email() }),
        handler: async () => ({ email: "not email" }),
      });
      const { responseMock } = await testEndpoint({
        endpoint,
      });
      expect(responseMock.status).toBeCalledWith(500);
      expect(responseMock.json).toBeCalledWith({
        status: "error",
        error: {
          message: "output/email: Invalid email",
        },
      });
    });

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
        middlewareDefinitionMock,
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
        "The middleware mockConstructor has closed the stream. Accumulated options:",
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
          getPositiveResponse: () => z.object({}),
          getNegativeResponse: () => z.object({}),
          handler: () => {
            throw new Error("Something unexpected happened");
          },
        }),
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
        "Result handler failure: Something unexpected happened.",
      );
      expect(responseMock.status).toBeCalledTimes(1);
      expect(responseMock.status.mock.calls[0][0]).toBe(500);
      expect(responseMock.json).toBeCalledTimes(0);
      expect(responseMock.end).toBeCalledTimes(1);
      expect(responseMock.end.mock.calls[0][0]).toBe(
        "An error occurred while serving the result: Something unexpected happened.",
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
      expect(endpoint.getSchema("input")).toEqual(input);
    });
  });

  describe(".getOperationId()", () => {
    test("should return undefined if its not defined upon creaton", () => {
      expect(
        new Endpoint({
          methods: ["get"],
          inputSchema: z.object({}),
          outputSchema: z.object({}),
          handler: async () => ({}),
          resultHandler: defaultResultHandler,
        }).getOperationId("get"),
      ).toBeUndefined();
    });
  });

  describe(".outputSchema", () => {
    test("should be the output schema", () => {
      const outputSchema = z.object({
        something: z.number(),
      });
      const endpoint = new Endpoint({
        methods: ["get"],
        inputSchema: z.object({}),
        outputSchema,
        handler: jest.fn(),
        resultHandler: defaultResultHandler,
      });
      expect(endpoint.getSchema("output")).toEqual(outputSchema);
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
        serializeSchemaForTest(endpoint.getSchema("positive")),
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
        serializeSchemaForTest(endpoint.getSchema("negative")),
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
      expect(endpoint.getMimeTypes("positive")).toEqual(["application/json"]);
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
      expect(endpoint.getMimeTypes("negative")).toEqual(["application/json"]);
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
          }),
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
          }),
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
          getPositiveResponse: () => z.object({}),
          getNegativeResponse: () => z.object({}),
          handler: () => {
            // eslint-disable-next-line @typescript-eslint/no-throw-literal
            throw "Something unexpected happened";
          },
        }),
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
        "Result handler failure: Something unexpected happened.",
      );
      expect(responseMock.status).toBeCalledTimes(1);
      expect(responseMock.status.mock.calls[0][0]).toBe(500);
      expect(responseMock.json).toBeCalledTimes(0);
      expect(responseMock.end).toBeCalledTimes(1);
      expect(responseMock.end.mock.calls[0][0]).toBe(
        "An error occurred while serving the result: Something unexpected happened.",
      );
    });

    test("thrown in middleware and caught in execute()", async () => {
      const factory = new EndpointsFactory(defaultResultHandler).addMiddleware(
        createMiddleware({
          input: z.object({}),
          middleware: async () => {
            // eslint-disable-next-line @typescript-eslint/no-throw-literal
            throw "Something went wrong";
          },
        }),
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

  describe("Issue #654: Top level refinements", () => {
    const endpoint = defaultEndpointsFactory.build({
      method: "post",
      input: z
        .object({
          type: z.union([z.literal("type1"), z.literal("type2")]),
          dynamicValue: z.union([
            z.object({ type1Attribute: z.number() }),
            z.object({ type2Attribute: z.string() }),
          ]),
          emitOutputValidationFailure: z.boolean().optional(),
        })
        .refine(
          (data) => {
            if (data.type === "type1") {
              return "type1Attribute" in data.dynamicValue;
            }
            return "type2Attribute" in data.dynamicValue;
          },
          {
            message: "type1Attribute is required if type is type1",
            path: ["dynamicValue"],
          },
        ),
      output: z
        .object({})
        .passthrough()
        .refine((obj) => !("emitOutputValidationFailure" in obj), {
          message: "failure on demand",
        }),
      handler: async ({ input }) =>
        input.emitOutputValidationFailure
          ? { emitOutputValidationFailure: true }
          : {},
    });

    test("should accept valid inputs", async () => {
      const { responseMock } = await testEndpoint({
        endpoint,
        requestProps: {
          method: "POST",
          body: {
            type: "type1",
            dynamicValue: { type1Attribute: 123 },
          },
        },
      });
      expect(responseMock.json).toHaveBeenCalledWith({
        data: {},
        status: "success",
      });
      expect(responseMock.status).toHaveBeenCalledWith(200);
    });

    test("should fail during the refinement of invalid inputs", async () => {
      const { responseMock } = await testEndpoint({
        endpoint,
        requestProps: {
          method: "POST",
          body: {
            type: "type1",
            dynamicValue: { type2Attribute: "test" },
          },
        },
      });
      expect(responseMock.json).toHaveBeenCalledWith({
        error: {
          message: "dynamicValue: type1Attribute is required if type is type1",
        },
        status: "error",
      });
      expect(responseMock.status).toHaveBeenCalledWith(400);
    });

    test("should refine the output schema as well", async () => {
      const { responseMock } = await testEndpoint({
        endpoint,
        requestProps: {
          method: "POST",
          body: {
            type: "type1",
            dynamicValue: { type1Attribute: 123 },
            emitOutputValidationFailure: true,
          },
        },
      });
      expect(responseMock.json).toHaveBeenCalledWith({
        status: "error",
        error: {
          message: "output: failure on demand",
        },
      });
      expect(responseMock.status).toHaveBeenCalledWith(500);
    });
  });

  describe("Feature #600: Top level refinements", () => {
    const endpoint = defaultEndpointsFactory.build({
      method: "post",
      input: z
        .object({
          email: z.string().email().optional(),
          id: z.string().optional(),
          otherThing: z.string().optional(),
        })
        .refine(
          (x) => Object.keys(x).length >= 1,
          "Please provide at least one property",
        ),
      output: z.object({}),
      handler: async () => ({}),
    });

    test("should accept valid inputs", async () => {
      const { responseMock } = await testEndpoint({
        endpoint,
        requestProps: {
          method: "POST",
          body: {
            id: "test",
          },
        },
      });
      expect(responseMock.json).toHaveBeenCalledWith({
        data: {},
        status: "success",
      });
      expect(responseMock.status).toHaveBeenCalledWith(200);
    });

    test("should fail during the refinement of invalid inputs", async () => {
      const { responseMock } = await testEndpoint({
        endpoint,
        requestProps: {
          method: "POST",
          body: {},
        },
      });
      expect(responseMock.json).toHaveBeenCalledWith({
        error: {
          message: "Please provide at least one property",
        },
        status: "error",
      });
      expect(responseMock.status).toHaveBeenCalledWith(400);
    });

    test("should throw when using transformation (constructor)", () => {
      expect(
        () =>
          new Endpoint({
            methods: ["get"],
            inputSchema: z.object({}).transform(() => []),
            outputSchema: z.object({}),
            handler: jest.fn(),
            resultHandler: {
              getPositiveResponse: jest.fn(),
              getNegativeResponse: jest.fn(),
              handler: jest.fn(),
            },
          }),
      ).toThrowError(
        new IOSchemaError(
          "Using transformations on the top level of endpoint input schema is not allowed.",
        ),
      );
      expect(
        () =>
          new Endpoint({
            methods: ["get"],
            inputSchema: z.object({}),
            outputSchema: z.object({}).transform(() => []),
            handler: jest.fn(),
            resultHandler: {
              getPositiveResponse: jest.fn(),
              getNegativeResponse: jest.fn(),
              handler: jest.fn(),
            },
          }),
      ).toThrowError(
        new IOSchemaError(
          "Using transformations on the top level of endpoint output schema is not allowed.",
        ),
      );
    });
  });

  describe("Issue #673: transformations in middlewares", () => {
    test("should avoid double parsing, should not mutate input", async () => {
      const dateInputMiddleware = createMiddleware({
        input: z.object({
          middleware_date_input: ez.dateIn().optional(),
        }),
        middleware: async ({ input: { middleware_date_input }, logger }) => {
          logger.debug("date in mw handler", typeof middleware_date_input);
          return {};
        },
      });

      const endpoint = defaultEndpointsFactory
        .addMiddleware(dateInputMiddleware)
        .build({
          method: "get",
          input: z.object({}),
          output: z.object({}),
          handler: async ({ input: { middleware_date_input }, logger }) => {
            logger.debug(
              "date in endpoint handler",
              typeof middleware_date_input,
            );
            return {};
          },
        });

      const { loggerMock, responseMock } = await testEndpoint({
        endpoint,
        requestProps: {
          query: {
            middleware_date_input: "2022-09-28",
          },
        },
      });

      expect(loggerMock.debug.mock.calls).toEqual([
        ["date in mw handler", "object"],
        ["date in endpoint handler", "object"],
      ]);
      expect(responseMock.status).toHaveBeenCalledWith(200);
    });
  });
});
