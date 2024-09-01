import assert from "node:assert/strict";
import { z } from "zod";
import {
  EndpointsFactory,
  Middleware,
  defaultEndpointsFactory,
  defaultResultHandler,
  ez,
  testEndpoint,
  ResultHandler,
} from "../../src";
import { AbstractEndpoint, Endpoint } from "../../src/endpoint";
import { serializeSchemaForTest } from "../helpers";
import { describe, expect, test, vi } from "vitest";

describe("Endpoint", () => {
  describe(".getMethods()", () => {
    test("Should return the correct set of methods", () => {
      const endpointMock = new Endpoint({
        methods: ["get", "post", "put", "delete", "patch"],
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        handler: vi.fn<any>(),
        resultHandler: new ResultHandler({
          positive: z.string(),
          negative: z.string(),
          handler: vi.fn(),
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
        handler: vi.fn<any>(),
        resultHandler: new ResultHandler({
          positive: z.string(),
          negative: z.string(),
          handler: vi.fn(),
        }),
      });
      expect(endpointMock.getMethods()).toEqual(["patch"]);
    });
  });

  describe(".execute()", () => {
    test("Should call middlewares, handler and resultHandler with correct arguments", async () => {
      const middlewareMock = vi
        .fn()
        .mockImplementationOnce(async ({ input }) => ({
          inc: input.n + 1,
        }));
      const resultHandlerSpy = vi.spyOn(defaultResultHandler, "execute");
      const factory = new EndpointsFactory(defaultResultHandler).addMiddleware({
        input: z.object({
          n: z.number(),
        }),
        handler: middlewareMock,
      });
      const handlerMock = vi
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
      expect(middlewareMock).toHaveBeenCalledTimes(1);
      expect(middlewareMock).toHaveBeenCalledWith({
        input: { n: 453 },
        options: {
          inc: 454, // due to reassignment of options
        },
        request: requestMock,
        response: responseMock,
        logger: loggerMock,
      });
      expect(handlerMock).toHaveBeenCalledTimes(1);
      expect(handlerMock).toHaveBeenCalledWith({
        input: { n: 453 },
        options: { inc: 454 },
        logger: loggerMock,
      });
      expect(loggerMock._getLogs().error).toHaveLength(0);
      expect(resultHandlerSpy).toHaveBeenCalledWith({
        error: null,
        input: { n: 453 },
        logger: loggerMock,
        options: { inc: 454 },
        output: { inc2: 455, str: "453.00", transform: 4 },
        request: requestMock,
        response: responseMock,
      });
      expect(responseMock._getStatusCode()).toBe(200);
      expect(responseMock._getJSONData()).toEqual({
        status: "success",
        data: { inc2: 455, str: "453.00", transform: 4 },
      });
    });

    test("should close the stream on OPTIONS request", async () => {
      const handlerMock = vi.fn();
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
      expect(loggerMock._getLogs().error).toHaveLength(0);
      expect(responseMock._getStatusCode()).toBe(200);
      expect(handlerMock).toHaveBeenCalledTimes(0);
      expect(responseMock._getHeaders()).toEqual({
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, OPTIONS",
        "access-control-allow-headers": "content-type",
        "x-custom-header": "Testing",
      });
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
      const { responseMock } = await testEndpoint({ endpoint });
      expect(responseMock._getStatusCode()).toBe(500);
      expect(responseMock._getJSONData()).toEqual({
        status: "error",
        error: { message: "output/email: Invalid email" },
      });
    });

    test("Should throw on output parsing non-Zod error", async () => {
      const factory = new EndpointsFactory(defaultResultHandler);
      const endpoint = factory.build({
        method: "post",
        input: z.object({}),
        output: z.object({
          test: z.number().transform(() => assert.fail("Something unexpected")),
        }),
        handler: async () => ({
          test: 123,
        }),
      });
      const { responseMock, loggerMock } = await testEndpoint({ endpoint });
      expect(loggerMock._getLogs().error).toHaveLength(1);
      expect(responseMock._getStatusCode()).toBe(500);
      expect(responseMock._getJSONData()).toEqual({
        status: "error",
        error: { message: "Something unexpected" },
      });
    });
  });

  describe("#runMiddlewares", () => {
    test("Should handle middleware closing the response stream", async () => {
      const middlewareMock = vi
        .fn()
        .mockImplementationOnce(async ({ input, response }) => {
          response.end("to hell with all that!");
          return { inc: input.n + 1 };
        });
      const factory = defaultEndpointsFactory.addMiddleware({
        input: z.object({
          n: z.number(),
        }),
        handler: middlewareMock,
      });
      const handlerMock = vi.fn();
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
      expect(loggerMock._getLogs().error).toHaveLength(0);
      expect(loggerMock._getLogs().warn).toEqual([
        [
          "A middleware has closed the stream. Accumulated options:",
          { inc: 454 },
        ],
      ]);
      expect(responseMock._getStatusCode()).toBe(200);
      expect(responseMock._getStatusMessage()).toBe("OK");
    });
  });

  describe("#handleResult", () => {
    test("Should handle errors within ResultHandler", async () => {
      const resultHandler = new ResultHandler({
        positive: z.object({}),
        negative: z.object({}),
        handler: vi.fn(() => assert.fail("Something unexpected happened")),
      });
      const spy = vi.spyOn(resultHandler, "execute");
      const factory = new EndpointsFactory(resultHandler);
      const endpoint = factory.build({
        method: "get",
        input: z.object({}),
        output: z.object({
          test: z.string(),
        }),
        handler: async () => ({ test: "OK" }),
      });
      const { loggerMock, responseMock, requestMock } = await testEndpoint({
        endpoint,
      });
      expect(loggerMock._getLogs().error).toEqual([
        ["Result handler failure: Something unexpected happened."],
      ]);
      expect(spy).toHaveBeenCalledWith({
        error: null,
        logger: loggerMock,
        input: {},
        options: {},
        output: { test: "OK" },
        request: requestMock,
        response: responseMock,
      });
      expect(responseMock._getStatusCode()).toBe(500);
      expect(responseMock._getHeaders()).toHaveProperty(
        "content-type",
        "text/plain",
      );
      expect(responseMock._getData()).toBe(
        "An error occurred while serving the result: Something unexpected happened.",
      );
    });
  });

  describe(".getSchema()", () => {
    test.each(["input", "output"] as const)(
      "should return the %s schema",
      (variant) => {
        const factory = new EndpointsFactory(defaultResultHandler);
        const input = z.object({
          something: z.number(),
        });
        const output = z.object({
          something: z.number(),
        });
        const endpoint = factory.build({
          method: "get",
          input,
          output,
          handler: vi.fn(),
        });
        expect((endpoint as AbstractEndpoint).getSchema(variant)).toEqual(
          variant === "input" ? input : output,
        );
      },
    );

    test.each(["positive", "negative"] as const)(
      "should return the %s response schema",
      (variant) => {
        const factory = new EndpointsFactory(defaultResultHandler);
        const endpoint = factory.build({
          method: "get",
          input: z.object({}),
          output: z.object({ something: z.number() }),
          handler: vi.fn(),
        });
        expect(
          serializeSchemaForTest(endpoint.getSchema(variant)),
        ).toMatchSnapshot();
      },
    );
  });

  describe("getMimeTypes()", () => {
    test.each(["input", "positive", "negative"] as const)(
      "should return the %s mime types",
      (variant) => {
        const factory = new EndpointsFactory(defaultResultHandler);
        const endpoint = factory.build({
          method: "get",
          input: z.object({}),
          output: z.object({ something: z.number() }),
          handler: vi.fn(),
        });
        expect(endpoint.getMimeTypes(variant)).toEqual(["application/json"]);
      },
    );
  });

  describe("getRequestType()", () => {
    test.each([
      { input: z.object({}), expected: "json" },
      { input: ez.raw(), expected: "raw" },
      { input: z.object({ file: ez.upload() }), expected: "upload" },
    ])(
      "should return the assigned one upon constructing",
      ({ input, expected }) => {
        const factory = new EndpointsFactory(defaultResultHandler);
        const endpoint = factory.build({
          method: "get",
          input,
          output: z.object({}),
          handler: vi.fn(),
        });
        expect(endpoint.getRequestType()).toEqual(expected);
      },
    );
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

  describe("Issue #269: Async refinements", () => {
    test("should handle async refinements in input, output and middleware", async () => {
      const endpoint = new EndpointsFactory(defaultResultHandler)
        .addMiddleware({
          input: z.object({
            m: z.number().refine(async (m) => m < 10),
          }),
          handler: async () => ({}),
        })
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
      expect(responseMock._getJSONData()).toEqual({
        status: "success",
        data: { str: "This is fine" },
      });
    });
  });

  describe("Issue #514: Express native middlewares for OPTIONS request", () => {
    test("should skip proprietary ones", async () => {
      const endpoint = new EndpointsFactory(defaultResultHandler)
        .addMiddleware({
          input: z.object({
            shouldNotBeHere: z.boolean(),
          }),
          handler: async () => assert.fail("Should not be here"),
        })
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
      expect(responseMock._getStatusCode()).toBe(200);
      expect(responseMock._getData()).toBe("");
      expect(responseMock._getHeaders()).toHaveProperty(
        "x-custom-header",
        "test",
      );
    });
  });

  describe("Issue #585: Handling non-Error exceptions", () => {
    test("thrown in #parseOutput()", async () => {
      const factory = new EndpointsFactory(defaultResultHandler);
      const endpoint = factory.build({
        method: "post",
        input: z.object({}),
        output: z.object({
          test: z.number().transform(() => assert.fail("Something unexpected")),
        }),
        handler: async () => ({
          test: 123,
        }),
      });
      const { responseMock, loggerMock } = await testEndpoint({ endpoint });
      expect(loggerMock._getLogs().error).toHaveLength(1);
      expect(responseMock._getStatusCode()).toBe(500);
      expect(responseMock._getJSONData()).toEqual({
        status: "error",
        error: { message: "Something unexpected" },
      });
    });

    test("thrown in #handleResult()", async () => {
      const factory = new EndpointsFactory(
        new ResultHandler({
          positive: z.object({}),
          negative: z.object({}),
          handler: () => assert.fail("Something unexpected happened"),
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
      expect(loggerMock._getLogs().error).toEqual([
        ["Result handler failure: Something unexpected happened."],
      ]);
      expect(responseMock._getStatusCode()).toBe(500);
      expect(responseMock._getData()).toBe(
        "An error occurred while serving the result: Something unexpected happened.",
      );
    });

    test("thrown in middleware and caught in execute()", async () => {
      const factory = new EndpointsFactory(defaultResultHandler).addMiddleware({
        input: z.object({}),
        handler: async () => assert.fail("Something went wrong"),
      });
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
      expect(loggerMock._getLogs().error).toHaveLength(1);
      expect(responseMock._getStatusCode()).toBe(500);
      expect(responseMock._getJSONData()).toEqual({
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
      expect(responseMock._getJSONData()).toEqual({
        status: "success",
        data: {},
      });
      expect(responseMock._getStatusCode()).toBe(200);
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
      expect(responseMock._getJSONData()).toEqual({
        status: "error",
        error: {
          message: "dynamicValue: type1Attribute is required if type is type1",
        },
      });
      expect(responseMock._getStatusCode()).toBe(400);
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
      expect(responseMock._getJSONData()).toEqual({
        status: "error",
        error: { message: "output: failure on demand" },
      });
      expect(responseMock._getStatusCode()).toBe(500);
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
      expect(responseMock._getJSONData()).toEqual({
        status: "success",
        data: {},
      });
      expect(responseMock._getStatusCode()).toBe(200);
    });

    test("should fail during the refinement of invalid inputs", async () => {
      const { responseMock } = await testEndpoint({
        endpoint,
        requestProps: {
          method: "POST",
          body: {},
        },
      });
      expect(responseMock._getJSONData()).toEqual({
        status: "error",
        error: { message: "Please provide at least one property" },
      });
      expect(responseMock._getStatusCode()).toBe(400);
    });
  });

  describe("Issue #673: transformations in middlewares", () => {
    test("should avoid double parsing, should not mutate input", async () => {
      const dateInputMiddleware = new Middleware({
        input: z.object({
          middleware_date_input: ez.dateIn().optional(),
        }),
        handler: async ({ input: { middleware_date_input }, logger }) => {
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

      expect(loggerMock._getLogs().debug).toEqual([
        ["date in mw handler", "object"],
        ["date in endpoint handler", "object"],
      ]);
      expect(responseMock._getStatusCode()).toBe(200);
    });
  });
});
