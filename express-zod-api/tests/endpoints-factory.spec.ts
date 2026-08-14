import "./peers-mock.ts";
import type { RequestHandler } from "express";
import createHttpError from "http-errors";
import { expectTypeOf } from "vitest";
import {
  EndpointsFactory,
  Middleware,
  defaultEndpointsFactory,
  ResultHandler,
  testMiddleware,
  type Method,
} from "../src";
import * as cookieMw from "../src/cookie-middleware";
import * as cacheMw from "../src/cache-middleware";
import * as rateLimitMw from "../src/rate-limit-middleware";
import type { EmptyObject } from "../src/common-helpers";
import { Endpoint } from "../src/endpoint";
import { z } from "zod";
import * as R from "ramda";

describe("EndpointsFactory", () => {
  const resultHandlerMock = new ResultHandler({
    positive: z.string(),
    negative: z.string(),
    handler: vi.fn(),
  });

  describe(".constructor()", () => {
    test("Should create the empty factory with result handler", () => {
      const factory = new EndpointsFactory(resultHandlerMock);
      expect(factory).toBeInstanceOf(EndpointsFactory);
      expect(factory["middlewares"]).toStrictEqual([]);
      expect(factory["resultHandler"]).toStrictEqual(resultHandlerMock);
    });

    test("Should create the factory with middleware and result handler", () => {
      const middleware = new Middleware({
        input: z.object({ n: z.number() }),
        handler: vi.fn(),
      });
      const factory = new EndpointsFactory(resultHandlerMock).addMiddleware(
        middleware,
      );
      expect(factory["middlewares"]).toStrictEqual([middleware]);
      expect(factory["resultHandler"]).toStrictEqual(resultHandlerMock);
    });
  });

  describe(".addMiddleware()", () => {
    test("Should create a new factory with a middleware and the same result handler", () => {
      const factory = new EndpointsFactory(resultHandlerMock);
      const middleware = new Middleware({
        input: z.object({ n: z.number() }),
        handler: vi.fn(),
      });
      const newFactory = factory.addMiddleware(middleware);
      expect(factory["middlewares"]).toStrictEqual([]);
      expect(factory["resultHandler"]).toStrictEqual(resultHandlerMock);
      expect(newFactory["middlewares"]).toStrictEqual([middleware]);
      expect(newFactory["resultHandler"]).toStrictEqual(resultHandlerMock);
    });

    test("Should maintain the chain of context", () => {
      defaultEndpointsFactory
        .addMiddleware(
          new Middleware({ handler: async () => ({ test: "fist" }) }),
        )
        .addMiddleware(
          new Middleware({
            handler: async ({ ctx }) => {
              expectTypeOf(ctx.test).toEqualTypeOf<string>();
              return { second: `another, ${ctx.test}` };
            },
          }),
        );
    });

    test("Should accept creation props without input schema", () => {
      const factory = defaultEndpointsFactory.addMiddleware({
        handler: async () => ({ test: "fist" }),
      });
      expectTypeOf(factory).toEqualTypeOf<
        EndpointsFactory<undefined, { test: string }>
      >();
    });

    test("Issue #2760: should strip excessive props by default", () => {
      defaultEndpointsFactory.build({
        input: z.object({ foo: z.string() }),
        output: z.object({ foo: z.string() }),
        handler: async ({ input }) => {
          expectTypeOf(input).not.toHaveProperty("bar");
          return input;
        },
      });
    });

    test("Issue #2760: should allow excessive props when using loose object schema", () => {
      defaultEndpointsFactory.build({
        input: z.looseObject({ foo: z.string() }),
        output: z.object({ foo: z.string() }),
        handler: async ({ input }) => {
          expectTypeOf(input).toHaveProperty("bar").toEqualTypeOf<unknown>();
          return input;
        },
      });
    });
  });

  describe(".addContext()", () => {
    test("Should create a new factory with an empty-input middleware and the same result handler", async () => {
      const factory = new EndpointsFactory(resultHandlerMock);
      const newFactory = factory
        .addContext(async () => ({ option1: "some value" }))
        .addContext(async (ctx) => ({
          option2: `not ${ctx.option1}`,
        }));
      expectTypeOf(newFactory).toEqualTypeOf<
        EndpointsFactory<undefined, { option1: string } & { option2: string }>
      >();
      expect(factory["middlewares"]).toStrictEqual([]);
      expect(factory["resultHandler"]).toStrictEqual(resultHandlerMock);
      expect(newFactory["middlewares"].length).toBe(2);
      expect(newFactory["middlewares"][0]!.schema).toBeUndefined();
      expect(newFactory["middlewares"][1]!.schema).toBeUndefined();
      const { output: first } = await testMiddleware({
        middleware: newFactory["middlewares"][0]!,
      });
      expect(first).toEqual({ option1: "some value" });
      expect(newFactory["resultHandler"]).toStrictEqual(resultHandlerMock);
      const { output: second } = await testMiddleware({
        middleware: newFactory["middlewares"][1]!,
        ctx: { option1: "some value" },
      });
      expect(second).toEqual({ option2: "not some value" });
    });
  });

  describe(".useCookies", () => {
    test("should add created cookie middleware", () => {
      const spy = vi.spyOn(cookieMw, "createCookieMiddleware");
      const factory = defaultEndpointsFactory.useCookies({ priority: "high" });
      expect(spy).toHaveBeenCalledWith({ priority: "high" });
      expect(factory["middlewares"]).toHaveLength(1);
    });
  });

  describe(".useCache", () => {
    test("should add created cache middleware", () => {
      const spy = vi.spyOn(cacheMw, "createCacheMiddleware");
      const factory = defaultEndpointsFactory.useCache({ maxAge: 100 });
      expect(spy).toHaveBeenCalledWith({ maxAge: 100 });
      expect(factory["middlewares"]).toHaveLength(1);
    });
  });

  describe(".useRateLimit", () => {
    test("should add created rate limit middleware", () => {
      const spy = vi.spyOn(rateLimitMw, "createRateLimitMiddleware");
      const factory = defaultEndpointsFactory.useRateLimit({ max: 20 });
      expect(spy).toHaveBeenCalledWith({ max: 20 });
      expect(factory["middlewares"]).toHaveLength(1);
    });
  });

  describe.each(["addExpressMiddleware", "use"] as const)(".%s()", (method) => {
    test("Should create a new factory with a native express middleware wrapper", async () => {
      const factory = new EndpointsFactory(resultHandlerMock);
      const middleware: RequestHandler = vi.fn((req, {}, next) => {
        req.body.test = "Here is the test";
        next();
      });
      const newFactory = factory[method](middleware, {
        provider: (req) => ({ result: req.body.test }),
      });
      expect(newFactory["middlewares"].length).toBe(1);
      expect(newFactory["middlewares"][0]!.schema).toBeUndefined();
      const {
        output: options,
        responseMock,
        requestMock,
      } = await testMiddleware({
        middleware: newFactory["middlewares"][0]!,
      });
      expect(middleware).toHaveBeenCalledTimes(1);
      expect(middleware).toHaveBeenCalledWith(
        requestMock,
        responseMock,
        expect.any(Function),
      );
      expect(requestMock.body).toHaveProperty("test");
      expect(requestMock.body.test).toBe("Here is the test");
      expect(options).toEqual({ result: "Here is the test" });
    });

    test("Should handle rejects from async middlewares", async () => {
      const factory = new EndpointsFactory(resultHandlerMock);
      const middleware: RequestHandler = vi.fn(async () =>
        assert.fail("Rejected"),
      );
      const newFactory = factory[method](middleware);
      expect(newFactory["middlewares"].length).toBe(1);
      const { responseMock } = await testMiddleware({
        middleware: newFactory["middlewares"][0]!,
      });
      expect(responseMock._getStatusCode()).toBe(500);
      expect(responseMock._getJSONData()).toEqual({
        error: { message: "Rejected" },
        status: "error",
      });
      expect(middleware).toHaveBeenCalledTimes(1);
    });

    test("Should operate without context provider", async () => {
      const factory = new EndpointsFactory(resultHandlerMock);
      const middleware: RequestHandler = vi.fn((req, {}, next) => {
        req.body.test = "Here is the test";
        next();
      });
      const newFactory = factory[method](middleware);
      expect(newFactory["middlewares"].length).toBe(1);
      const {
        output: options,
        responseMock,
        requestMock,
      } = await testMiddleware({
        middleware: newFactory["middlewares"][0]!,
      });
      expect(middleware).toHaveBeenCalledTimes(1);
      expect(middleware).toHaveBeenCalledWith(
        requestMock,
        responseMock,
        expect.any(Function),
      );
      expect(requestMock.body).toHaveProperty("test");
      expect(requestMock.body.test).toBe("Here is the test");
      expect(options).toEqual({});
    });

    test("Should handle errors", async () => {
      const factory = new EndpointsFactory(resultHandlerMock);
      const middleware: RequestHandler = vi.fn(({}, {}, next) => {
        next(new Error("This one has failed"));
      });
      const newFactory = factory[method](middleware);
      expect(newFactory["middlewares"].length).toBe(1);
      const { responseMock } = await testMiddleware({
        middleware: newFactory["middlewares"][0]!,
      });
      expect(responseMock._getStatusCode()).toBe(500);
      expect(responseMock._getJSONData()).toEqual({
        error: { message: "This one has failed" },
        status: "error",
      });
      expect(middleware).toHaveBeenCalledTimes(1);
    });

    test.each([123, {}, { catch: "test" }])(
      "should handle broken middlewares that do not call next() sync %#",
      async (value) => {
        const factory = new EndpointsFactory(resultHandlerMock);
        const middleware: RequestHandler = vi.fn(({}, {}, next) => {
          setTimeout(next, 250);
          return value;
        });
        const newFactory = factory[method](middleware);
        expect(newFactory["middlewares"].length).toBe(1);
        const { responseMock } = await testMiddleware({
          middleware: newFactory["middlewares"][0]!,
        });
        expect(responseMock._getStatusCode()).toBe(200);
        expect(middleware).toHaveBeenCalledTimes(1);
      },
    );

    test("Should transform errors", async () => {
      const factory = new EndpointsFactory(resultHandlerMock);
      const middleware: RequestHandler = vi.fn(({}, {}, next) => {
        next(new Error("This one has failed"));
      });
      const newFactory = factory[method](middleware, {
        transformer: (err) => createHttpError(401, err.message),
      });
      expect(newFactory["middlewares"].length).toBe(1);
      const { responseMock } = await testMiddleware({
        middleware: newFactory["middlewares"][0]!,
      });
      expect(responseMock._getStatusCode()).toBe(401);
      expect(responseMock._getJSONData()).toEqual({
        error: { message: "This one has failed" },
        status: "error",
      });
      expect(middleware).toHaveBeenCalledTimes(1);
    });
  });

  describe(".build()", () => {
    test("Should create an endpoint with simple middleware", () => {
      const middleware = new Middleware({
        input: z.object({ n: z.number() }),
        handler: vi.fn(),
      });
      const factory = new EndpointsFactory(resultHandlerMock).addMiddleware(
        middleware,
      );
      const handlerMock = vi.fn();
      const endpoint = factory.build({
        input: z.object({ s: z.string() }),
        output: z.object({ b: z.boolean() }),
        handler: handlerMock,
      });
      expect(endpoint).toBeInstanceOf(Endpoint);
      expect(endpoint.methods.size).toBe(0);
      expect(endpoint.inputSchema).toMatchSnapshot();
      expect(endpoint.outputSchema).toMatchSnapshot();
      expectTypeOf(endpoint.inputSchema._zod.output).toEqualTypeOf<
        { n: number } & { s: string }
      >();
    });

    test("Should create an endpoint with refined object middleware", () => {
      const middleware = new Middleware({
        input: z
          .object({
            a: z.number().optional(),
            b: z.string().optional(),
          })
          .refine((props) => Object.keys(props).length, {
            message: "Should be at least one option specified",
          }),
        handler: vi.fn(),
      });
      const factory = new EndpointsFactory(resultHandlerMock).addMiddleware(
        middleware,
      );
      const endpoint = factory.build({
        input: z.object({ i: z.string() }),
        output: z.object({ o: z.boolean() }),
        handler: vi.fn(),
      });
      expect(endpoint.inputSchema).toMatchSnapshot();
      expect(endpoint.outputSchema).toMatchSnapshot();
      expectTypeOf(endpoint.inputSchema._zod.output).toEqualTypeOf<
        { a?: number; b?: string } & { i: string }
      >();
    });

    test("Should create an endpoint with intersection middleware", () => {
      const middleware = new Middleware({
        input: z.object({ n1: z.number() }).and(z.object({ n2: z.number() })),
        handler: vi.fn(),
      });
      const factory = new EndpointsFactory(resultHandlerMock).addMiddleware(
        middleware,
      );
      const handlerMock = vi.fn();
      const endpoint = factory.build({
        input: z.object({ s: z.string() }),
        output: z.object({ b: z.boolean() }),
        handler: handlerMock,
      });
      expect(endpoint).toBeInstanceOf(Endpoint);
      expect(endpoint.methods.size).toBe(0);
      expect(endpoint.inputSchema).toMatchSnapshot();
      expect(endpoint.outputSchema).toMatchSnapshot();
      expectTypeOf(endpoint.inputSchema._zod.output).toEqualTypeOf<
        { n1: number } & { n2: number } & { s: string }
      >();
    });

    test("Should create an endpoint with union middleware", () => {
      const middleware = new Middleware({
        input: z.object({ n1: z.number() }).or(z.object({ n2: z.number() })),
        handler: vi.fn(),
      });
      const factory = new EndpointsFactory(resultHandlerMock).addMiddleware(
        middleware,
      );
      const handlerMock = vi.fn().mockImplementation((params) => ({
        input: params.input,
        b: true,
      }));
      const endpoint = factory.build({
        input: z.object({ s: z.string() }),
        output: z.object({ b: z.boolean() }),
        handler: handlerMock,
      });
      expect(endpoint).toBeInstanceOf(Endpoint);
      expect(endpoint.methods.size).toBe(0);
      expect(endpoint.inputSchema).toMatchSnapshot();
      expect(endpoint.outputSchema).toMatchSnapshot();
      expectTypeOf(endpoint.inputSchema._zod.output).toEqualTypeOf<
        { s: string } & ({ n1: number } | { n2: number })
      >();
    });

    test("should create an endpoint without input schema", () => {
      const factory = new EndpointsFactory(resultHandlerMock);
      const endpoint = factory.build({
        method: "get",
        deprecated: true,
        output: z.object({}),
        handler: vi.fn(),
      });
      expectTypeOf(
        endpoint.inputSchema._zod.output,
      ).toEqualTypeOf<EmptyObject>();
      expect(endpoint.isDeprecated).toBe(true);
    });

    test("should deduplicate the methods declared in the tuple", () => {
      const endpoint = new EndpointsFactory(resultHandlerMock).buildVoid({
        method: ["get", "post", "get"],
        handler: vi.fn(),
      });
      expect(Array.from(endpoint.methods)).toEqual(["get", "post"]);
    });

    test("should not mutate the supplied array of methods when building", () => {
      const methods = ["get", "post"] as [Method, ...Method[]];
      const endpoint = new EndpointsFactory(resultHandlerMock).buildVoid({
        method: methods,
        handler: vi.fn(),
      });
      expect(Object.isFrozen(methods)).toBe(false);
      methods.push("put");
      expect(Array.from(endpoint.methods)).toEqual(["get", "post"]);
    });

    test("should deduplicate the tags declared in the tuple", () => {
      const endpoint = new EndpointsFactory(resultHandlerMock).buildVoid({
        tag: ["users", "users", "files"],
        handler: vi.fn(),
      });
      expect(Array.from(endpoint.tags)).toEqual(["users", "files"]);
    });

    test("should not mutate the supplied array of tags when building", () => {
      const tags = ["users", "files"];
      const endpoint = new EndpointsFactory(resultHandlerMock).buildVoid({
        tag: tags,
        handler: vi.fn(),
      });
      expect(Object.isFrozen(tags)).toBe(false);
      tags.push("extra");
      expect(Array.from(endpoint.tags)).toEqual(["users", "files"]);
    });

    test("should deduplicate the scopes declared in the tuple", () => {
      const endpoint = new EndpointsFactory(resultHandlerMock).buildVoid({
        scope: ["admin", "admin", "read"],
        handler: vi.fn(),
      });
      expect(Array.from(endpoint.scopes)).toEqual(["admin", "read"]);
    });

    test("should not mutate the supplied array of scopes when building", () => {
      const scopes = ["admin", "read"];
      const endpoint = new EndpointsFactory(resultHandlerMock).buildVoid({
        scope: scopes,
        handler: vi.fn(),
      });
      expect(Object.isFrozen(scopes)).toBe(false);
      scopes.push("write");
      expect(Array.from(endpoint.scopes)).toEqual(["admin", "read"]);
    });

    test("should pass the single statusCode to the endpoint", () => {
      const endpoint = new EndpointsFactory(resultHandlerMock).buildVoid({
        handler: vi.fn(),
        statusCode: 204,
      });
      expect(R.pluck("statusCodes", endpoint.getResponses("positive"))).toEqual(
        [[204]],
      );
    });

    test("should pass the tuple of statusCodes to the endpoint", () => {
      const endpoint = new EndpointsFactory(resultHandlerMock).buildVoid({
        handler: vi.fn(),
        statusCode: [201, 400],
      });
      expect(R.pluck("statusCodes", endpoint.getResponses("positive"))).toEqual(
        [[201]],
      );
      expect(R.pluck("statusCodes", endpoint.getResponses("negative"))).toEqual(
        [[400]],
      );
    });

    test("should combine the status codes declared by the middlewares", () => {
      const endpoint = new EndpointsFactory(resultHandlerMock)
        .addMiddleware({ statusCode: 429, handler: vi.fn() })
        .buildVoid({ handler: vi.fn() });
      expect(R.pluck("statusCodes", endpoint.getResponses("positive"))).toEqual(
        [[200]],
      );
      expect(R.pluck("statusCodes", endpoint.getResponses("negative"))).toEqual(
        [[429]],
      );
    });

    test("should deduplicate the status codes declared by the endpoint and middlewares", () => {
      const endpoint = new EndpointsFactory(resultHandlerMock)
        .addMiddleware({ statusCode: [400, 429], handler: vi.fn() })
        .buildVoid({ handler: vi.fn(), statusCode: [200, 400] });
      expect(R.pluck("statusCodes", endpoint.getResponses("positive"))).toEqual(
        [[200]],
      );
      expect(R.pluck("statusCodes", endpoint.getResponses("negative"))).toEqual(
        [[400, 429]],
      );
    });
  });

  describe(".buildVoid()", () => {
    test("Should be a shorthand for empty object output", () => {
      const factory = new EndpointsFactory(resultHandlerMock);
      const endpoint = factory.buildVoid({
        handler: async () => {},
      });
      expect(endpoint.outputSchema).toMatchSnapshot();
      expectTypeOf(endpoint.outputSchema.shape).toExtend<EmptyObject>();
    });

    test("Should pass the statusCode option", () => {
      const endpoint = new EndpointsFactory(resultHandlerMock).buildVoid({
        handler: vi.fn(),
        statusCode: 204,
      });
      expect(
        endpoint.getResponses("positive").map(({ statusCodes }) => statusCodes),
      ).toEqual([[204]]);
    });
  });
});
