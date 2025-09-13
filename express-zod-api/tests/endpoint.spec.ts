import { z } from "zod";
import {
  EndpointsFactory,
  Middleware,
  defaultEndpointsFactory,
  defaultResultHandler,
  ez,
  testEndpoint,
  ResultHandler,
} from "../src";
import { Endpoint } from "../src/endpoint";

describe("Endpoint", () => {
  describe(".methods", () => {
    test("Should return the correct set of methods (readonly)", () => {
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
      const { methods } = endpointMock;
      expect(methods).toEqual(["get", "post", "put", "delete", "patch"]);
      expect(() => (methods as any[]).push()).toThrowError(/read only/);
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
        .mockImplementationOnce(async ({ input, ctx }) => ({
          inc2: (ctx as { inc: number }).inc + 1,
          str: input.n.toFixed(2),
          transform: "test",
        }));
      const endpoint = factory.build({
        method: "post",
        input: z.object({ n: z.number() }),
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
        ctx: {
          inc: 454, // due to reassignment
        },
        request: requestMock,
        response: responseMock,
        logger: loggerMock,
      });
      expect(handlerMock).toHaveBeenCalledTimes(1);
      expect(handlerMock).toHaveBeenCalledWith({
        input: { n: 453 },
        ctx: { inc: 454 },
        logger: loggerMock,
      });
      expect(loggerMock._getLogs().error).toHaveLength(0);
      expect(resultHandlerSpy).toHaveBeenCalledWith({
        error: null,
        input: { n: 453 },
        logger: loggerMock,
        ctx: { inc: 454 },
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
        output: z.object({}),
        handler: handlerMock,
      });
      const { responseMock, loggerMock } = await testEndpoint({
        endpoint,
        requestProps: { method: "OPTIONS" },
      });
      expect(loggerMock._getLogs().error).toHaveLength(0);
      expect(responseMock._getStatusCode()).toBe(200);
      expect(handlerMock).toHaveBeenCalledTimes(0);
      expect(responseMock.writableEnded).toBeTruthy();
    });
  });

  describe(".deprecated()", () => {
    test("should make a deprecated copy of the endpoint", () => {
      const endpointMock = defaultEndpointsFactory.build({
        output: z.object({}),
        handler: vi.fn(),
      });
      expect(endpointMock.isDeprecated).toBe(false);
      const copy = endpointMock.deprecated();
      expect(copy.isDeprecated).toBe(true);
      expect(copy).not.toBe(endpointMock);
    });
  });

  describe("#parseOutput", () => {
    test("Should throw on output validation failure", async () => {
      const endpoint = defaultEndpointsFactory.build({
        method: "post",
        output: z.object({ email: z.email() }),
        handler: async () => ({ email: "not email" }),
      });
      const { responseMock } = await testEndpoint({ endpoint });
      expect(responseMock._getStatusCode()).toBe(500);
      expect(responseMock._getJSONData()).toMatchSnapshot();
    });

    test("Should throw on output parsing non-Zod error", async () => {
      const factory = new EndpointsFactory(defaultResultHandler);
      const endpoint = factory.build({
        method: "post",
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
          "A middleware has closed the stream. Accumulated context:",
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
        output: z.object({ test: z.string() }),
        handler: async () => ({ test: "OK" }),
      });
      const { loggerMock, responseMock, requestMock } = await testEndpoint({
        endpoint,
      });
      expect(loggerMock._getLogs().error).toMatchSnapshot();
      expect(spy).toHaveBeenCalledWith({
        error: null,
        logger: loggerMock,
        input: {},
        ctx: {},
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

  describe.each(["inputSchema", "outputSchema"] as const)(
    ".%s prop",
    (prop) => {
      test("should return the %s", () => {
        const factory = new EndpointsFactory(defaultResultHandler);
        const input = z.object({ something: z.number() });
        const output = z.object({ something: z.string() });
        const endpoint = factory.build({
          input,
          output,
          handler: vi.fn(),
        });
        expect(endpoint[prop]).toEqual(prop === "inputSchema" ? input : output);
      });
    },
  );

  describe(".getResponses()", () => {
    test.each(["positive", "negative"] as const)(
      "should return the %s responses (readonly)",
      (variant) => {
        const factory = new EndpointsFactory(defaultResultHandler);
        const endpoint = factory.build({
          output: z.object({ something: z.number() }),
          handler: vi.fn(),
        });
        const responses = endpoint.getResponses(variant);
        expect(responses).toMatchSnapshot();
        expect(() => (responses as any[]).push()).toThrowError(/read only/);
      },
    );
  });

  describe(".scopes", () => {
    test.each(["test", ["one", "two"]])(
      "should return the scopes (readonly) %#",
      (scope) => {
        const factory = new EndpointsFactory(defaultResultHandler);
        const endpoint = factory.build({
          output: z.object({ something: z.number() }),
          handler: vi.fn(),
          scope,
        });
        const { scopes } = endpoint;
        expect(scopes).toEqual(typeof scope === "string" ? [scope] : scope);
        expect(() => (scopes as any[]).push()).toThrowError(/read only/);
      },
    );
  });

  describe(".tags", () => {
    test.each(["test", ["one", "two"]])(
      "should return the tags (readonly) %#",
      (tag) => {
        const factory = new EndpointsFactory(defaultResultHandler);
        const endpoint = factory.build({
          output: z.object({ something: z.number() }),
          handler: vi.fn(),
          tag,
        });
        const { tags } = endpoint;
        expect(tags).toEqual(typeof tag === "string" ? [tag] : tag);
        expect(() => (tags as any[]).push()).toThrowError(/read only/);
      },
    );
  });

  describe(".security", () => {
    test("should return a array of security based logical containers", () => {
      const endpoint = defaultEndpointsFactory
        .addMiddleware({
          security: { type: "header", name: "X-Token" },
          handler: vi.fn(),
        })
        .addMiddleware({
          security: { type: "header", name: "X-API-Key" },
          handler: vi.fn(),
        })
        .build({ output: z.object({}), handler: vi.fn() });
      const { security } = endpoint;
      expect(security).toEqual([
        { name: "X-Token", type: "header" },
        { name: "X-API-Key", type: "header" },
      ]);
    });
  });

  describe(".requestType", () => {
    test.each([
      { input: z.object({}), expected: "json" },
      { input: ez.raw(), expected: "raw" },
      { input: z.object({ file: ez.upload() }), expected: "upload" },
      { input: ez.form({}), expected: "form" },
      { input: ez.form({ file: ez.upload() }), expected: "upload" },
    ])(
      "should return the one based on the input schema %#",
      ({ input, expected }) => {
        const factory = new EndpointsFactory(defaultResultHandler);
        const endpoint = factory.build({
          input,
          output: z.object({}),
          handler: vi.fn(),
        });
        expect(endpoint.requestType).toEqual(expected);
      },
    );
  });

  describe(".getOperationId()", () => {
    test("should return undefined if its not defined upon creation", () => {
      expect(
        new Endpoint({
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
          method: "post",
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
          method: "post",
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
        output: z.object({ test: z.string() }),
        handler: async () => ({ test: "OK" }),
      });
      const { loggerMock, responseMock } = await testEndpoint({ endpoint });
      expect(loggerMock._getLogs().error).toMatchSnapshot();
      expect(responseMock._getStatusCode()).toBe(500);
      expect(responseMock._getData()).toBe(
        "An error occurred while serving the result: Something unexpected happened.",
      );
    });

    test("thrown in middleware and caught in execute()", async () => {
      const factory = new EndpointsFactory(defaultResultHandler).addMiddleware({
        handler: async () => assert.fail("Something went wrong"),
      });
      const endpoint = factory.build({
        method: "post",
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
          (data) =>
            (data.type === "type1" ? "type1Attribute" : "type2Attribute") in
            data.dynamicValue,
          {
            message: "type1Attribute is required if type is type1",
            path: ["dynamicValue"],
          },
        ),
      output: z
        .looseObject({})
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
          email: z.email().optional(),
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
        .buildVoid({
          handler: async ({ input: { middleware_date_input }, logger }) =>
            logger.debug(
              "date in endpoint handler",
              typeof middleware_date_input,
            ),
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
