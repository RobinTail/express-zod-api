import { RequestHandler } from "express";
import createHttpError from "http-errors";
import {
  EndpointsFactory,
  Middleware,
  defaultEndpointsFactory,
  ResultHandler,
  testMiddleware,
} from "../../src";
import { EmptyObject, EmptySchema } from "../../src/common-helpers";
import { Endpoint } from "../../src/endpoint";
import { serializeSchemaForTest } from "../helpers";
import { z } from "zod";

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
        handler: vi.fn<any>(),
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
        handler: vi.fn<any>(),
      });
      const newFactory = factory.addMiddleware(middleware);
      expect(factory["middlewares"]).toStrictEqual([]);
      expect(factory["resultHandler"]).toStrictEqual(resultHandlerMock);
      expect(newFactory["middlewares"]).toStrictEqual([middleware]);
      expect(newFactory["resultHandler"]).toStrictEqual(resultHandlerMock);
    });

    test("Should maintain the chain of options", () => {
      defaultEndpointsFactory
        .addMiddleware(
          new Middleware({
            handler: async () => ({ test: "fist option" }),
          }),
        )
        .addMiddleware(
          new Middleware({
            handler: async ({ options }) => {
              expectTypeOf(options.test).toEqualTypeOf<string>();
              return { second: `another option, ${options.test}` };
            },
          }),
        );
    });

    test("Should accept creation props without input schema", () => {
      const factory = defaultEndpointsFactory.addMiddleware({
        handler: async () => ({ test: "fist option" }),
      });
      expectTypeOf(factory).toMatchTypeOf<
        EndpointsFactory<
          z.ZodIntersection<EmptySchema, EmptySchema>,
          EmptyObject & { test: string }
        >
      >();
    });
  });

  describe(".addOptions()", () => {
    test("Should create a new factory with an empty-input middleware and the same result handler", async () => {
      const factory = new EndpointsFactory(resultHandlerMock);
      const newFactory = factory.addOptions(async () => ({
        option1: "some value",
        option2: "other value",
      }));
      expectTypeOf(newFactory).toEqualTypeOf<
        EndpointsFactory<
          EmptySchema,
          EmptyObject & { option1: string; option2: string }
        >
      >();
      expect(factory["middlewares"]).toStrictEqual([]);
      expect(factory["resultHandler"]).toStrictEqual(resultHandlerMock);
      expect(newFactory["middlewares"].length).toBe(1);
      expect(newFactory["middlewares"][0].getSchema()).toBeInstanceOf(
        z.ZodObject,
      );
      expect(
        (newFactory["middlewares"][0].getSchema() as z.AnyZodObject).shape,
      ).toEqual({});
      const { output: options } = await testMiddleware({
        middleware: newFactory["middlewares"][0],
      });
      expect(options).toEqual({
        option1: "some value",
        option2: "other value",
      });
      expect(newFactory["resultHandler"]).toStrictEqual(resultHandlerMock);
    });
  });

  describe.each(["addExpressMiddleware" as const, "use" as const])(
    ".%s()",
    (method) => {
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
        expect(newFactory["middlewares"][0].getSchema()).toBeInstanceOf(
          z.ZodObject,
        );
        expect(
          (newFactory["middlewares"][0].getSchema() as z.AnyZodObject).shape,
        ).toEqual({});
        const {
          output: options,
          responseMock,
          requestMock,
        } = await testMiddleware({
          middleware: newFactory["middlewares"][0],
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
        await expect(() =>
          testMiddleware({
            middleware: newFactory["middlewares"][0],
          }),
        ).rejects.toThrow(new Error("Rejected"));
        expect(middleware).toHaveBeenCalledTimes(1);
      });

      test("Should operate without options provider", async () => {
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
          middleware: newFactory["middlewares"][0],
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
        await expect(() =>
          testMiddleware({
            middleware: newFactory["middlewares"][0],
          }),
        ).rejects.toThrowError("This one has failed");
        expect(middleware).toHaveBeenCalledTimes(1);
      });

      test("Should transform errors", async () => {
        const factory = new EndpointsFactory(resultHandlerMock);
        const middleware: RequestHandler = vi.fn(({}, {}, next) => {
          next(new Error("This one has failed"));
        });
        const newFactory = factory[method](middleware, {
          transformer: (err) => createHttpError(401, err.message),
        });
        await expect(() =>
          testMiddleware({
            middleware: newFactory["middlewares"][0],
          }),
        ).rejects.toThrowErrorMatchingSnapshot();
        expect(middleware).toHaveBeenCalledTimes(1);
      });
    },
  );

  describe(".build()", () => {
    test("Should create an endpoint with simple middleware", () => {
      const middleware = new Middleware({
        input: z.object({ n: z.number() }),
        handler: vi.fn<any>(),
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
      expect(endpoint.getMethods()).toBeUndefined();
      expect(
        serializeSchemaForTest(endpoint.getSchema("input")),
      ).toMatchSnapshot();
      expect(
        serializeSchemaForTest(endpoint.getSchema("output")),
      ).toMatchSnapshot();
      expectTypeOf(endpoint.getSchema("input")._output).toMatchTypeOf<{
        n: number;
        s: string;
      }>();
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
        handler: vi.fn<any>(),
      });
      const factory = new EndpointsFactory(resultHandlerMock).addMiddleware(
        middleware,
      );
      const endpoint = factory.build({
        input: z.object({ i: z.string() }),
        output: z.object({ o: z.boolean() }),
        handler: vi.fn(),
      });
      expect(
        serializeSchemaForTest(endpoint.getSchema("input")),
      ).toMatchSnapshot();
      expect(
        serializeSchemaForTest(endpoint.getSchema("output")),
      ).toMatchSnapshot();
      expectTypeOf(endpoint.getSchema("input")._output).toMatchTypeOf<{
        a?: number;
        b?: string;
        i: string;
      }>();
    });

    test("Should create an endpoint with intersection middleware", () => {
      const middleware = new Middleware({
        input: z.object({ n1: z.number() }).and(z.object({ n2: z.number() })),
        handler: vi.fn<any>(),
      });
      const factory = new EndpointsFactory(resultHandlerMock).addMiddleware(
        middleware,
      );
      const handlerMock = vi.fn();
      const endpoint = factory.build({
        methods: ["get"],
        input: z.object({ s: z.string() }),
        output: z.object({ b: z.boolean() }),
        handler: handlerMock,
      });
      expect(endpoint).toBeInstanceOf(Endpoint);
      expect(endpoint.getMethods()).toStrictEqual(["get"]);
      expect(
        serializeSchemaForTest(endpoint.getSchema("input")),
      ).toMatchSnapshot();
      expect(
        serializeSchemaForTest(endpoint.getSchema("output")),
      ).toMatchSnapshot();
      expectTypeOf(endpoint.getSchema("input")._output).toMatchTypeOf<{
        n1: number;
        n2: number;
        s: string;
      }>();
    });

    test("Should create an endpoint with union middleware", () => {
      const middleware = new Middleware({
        input: z.object({ n1: z.number() }).or(z.object({ n2: z.number() })),
        handler: vi.fn<any>(),
      });
      const factory = new EndpointsFactory(resultHandlerMock).addMiddleware(
        middleware,
      );
      const handlerMock = vi.fn().mockImplementation((params) => ({
        input: params.input,
        b: true,
      }));
      const endpoint = factory.build({
        methods: ["get"],
        input: z.object({ s: z.string() }),
        output: z.object({ b: z.boolean() }),
        handler: handlerMock,
      });
      expect(endpoint).toBeInstanceOf(Endpoint);
      expect(endpoint.getMethods()).toStrictEqual(["get"]);
      expect(
        serializeSchemaForTest(endpoint.getSchema("input")),
      ).toMatchSnapshot();
      expect(
        serializeSchemaForTest(endpoint.getSchema("output")),
      ).toMatchSnapshot();
      expectTypeOf(endpoint.getSchema("input")._output).toMatchTypeOf<
        { s: string } & ({ n1: number } | { n2: number })
      >();
    });

    test("should create an endpoint without input schema", () => {
      const factory = new EndpointsFactory(resultHandlerMock);
      const endpoint = factory.build({
        method: "get",
        output: z.object({}),
        handler: vi.fn(),
      });
      expectTypeOf(
        endpoint.getSchema("input")._output,
      ).toEqualTypeOf<EmptyObject>();
    });
  });
});
