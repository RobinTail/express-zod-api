import { Request, RequestHandler, Response } from "express";
import createHttpError, { HttpError } from "http-errors";
import {
  EndpointsFactory,
  createMiddleware,
  createResultHandler,
  defaultEndpointsFactory,
} from "../../src";
import { Endpoint } from "../../src/endpoint";
import { expectType } from "tsd";
import { AbstractLogger } from "../../src/logger";
import { makeLoggerMock } from "../../src/testing";
import { serializeSchemaForTest } from "../helpers";
import { z } from "zod";
import { describe, expect, test, vi } from "vitest";

describe("EndpointsFactory", () => {
  /* eslint-disable @typescript-eslint/dot-notation */

  describe(".constructor()", () => {
    test("Should create the empty factory with result handler", () => {
      const resultHandlerMock = createResultHandler({
        getPositiveResponse: () => z.string(),
        getNegativeResponse: () => z.string(),
        handler: vi.fn(),
      });
      const factory = new EndpointsFactory(resultHandlerMock);
      expect(factory).toBeInstanceOf(EndpointsFactory);
      expect(factory["middlewares"]).toStrictEqual([]);
      expect(factory["resultHandler"]).toStrictEqual(resultHandlerMock);
    });

    test("Should create the factory with middleware and result handler", () => {
      const middleware = createMiddleware({
        input: z.object({
          n: z.number(),
        }),
        middleware: vi.fn(),
      });
      const resultHandlerMock = createResultHandler({
        getPositiveResponse: () => z.string(),
        getNegativeResponse: () => z.string(),
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
      const resultHandlerMock = createResultHandler({
        getPositiveResponse: () => z.string(),
        getNegativeResponse: () => z.string(),
        handler: vi.fn(),
      });
      const factory = new EndpointsFactory(resultHandlerMock);
      const middleware = createMiddleware({
        input: z.object({
          n: z.number(),
        }),
        middleware: vi.fn(),
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
          createMiddleware({
            input: z.object({}),
            middleware: async () => ({ test: "fist option" }),
          }),
        )
        .addMiddleware(
          createMiddleware({
            input: z.object({}),
            middleware: async ({ options }) => ({
              second: `another option, ${options.test}`,
            }),
          }),
        );
      expect(true).toBeTruthy();
    });
  });

  describe(".addOptions()", () => {
    test.each([
      {
        option1: "some value",
        option2: "other value",
      },
      async () => ({
        option1: "some value",
        option2: "other value",
      }),
    ])(
      "Should create a new factory with an empty-input middleware and the same result handler",
      async (options) => {
        const resultHandlerMock = createResultHandler({
          getPositiveResponse: () => z.string(),
          getNegativeResponse: () => z.string(),
          handler: vi.fn(),
        });
        const factory = new EndpointsFactory(resultHandlerMock);
        const newFactory = factory.addOptions(options);
        expect(factory["middlewares"]).toStrictEqual([]);
        expect(factory["resultHandler"]).toStrictEqual(resultHandlerMock);
        expect(newFactory["middlewares"].length).toBe(1);
        expect(newFactory["middlewares"][0].input).toBeInstanceOf(z.ZodObject);
        expect(
          (newFactory["middlewares"][0].input as z.AnyZodObject).shape,
        ).toEqual({});
        expect(
          await newFactory["middlewares"][0].middleware({
            input: {},
            options: {},
            request: {} as Request,
            response: {} as Response,
            logger: makeLoggerMock({ fnMethod: vi.fn }),
          }),
        ).toEqual({
          option1: "some value",
          option2: "other value",
        });
        expect(newFactory["resultHandler"]).toStrictEqual(resultHandlerMock);
      },
    );
  });

  describe.each(["addExpressMiddleware" as const, "use" as const])(
    ".%s()",
    (method) => {
      test("Should create a new factory with a native express middleware wrapper", async () => {
        const resultHandlerMock = createResultHandler({
          getPositiveResponse: () => z.string(),
          getNegativeResponse: () => z.string(),
          handler: vi.fn(),
        });
        const factory = new EndpointsFactory(resultHandlerMock);
        const middleware: RequestHandler = vi.fn((req, {}, next) => {
          req.body.test = "Here is the test";
          next();
        });
        const newFactory = factory[method](middleware, {
          provider: (req) => ({
            result: req.body.test,
          }),
        });
        expect(newFactory["middlewares"].length).toBe(1);
        expect(newFactory["middlewares"][0].input).toBeInstanceOf(z.ZodObject);
        expect(
          (newFactory["middlewares"][0].input as z.AnyZodObject).shape,
        ).toEqual({});
        const requestMock = { body: { something: "awesome" } } as Request;
        const responseMock = {} as Response;
        const options = await newFactory["middlewares"][0].middleware({
          input: {},
          options: {},
          request: requestMock,
          response: responseMock,
          logger: {} as AbstractLogger,
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

      test("Should operate without options provider", async () => {
        const resultHandlerMock = createResultHandler({
          getPositiveResponse: () => z.string(),
          getNegativeResponse: () => z.string(),
          handler: vi.fn(),
        });
        const factory = new EndpointsFactory(resultHandlerMock);
        const middleware: RequestHandler = vi.fn((req, {}, next) => {
          req.body.test = "Here is the test";
          next();
        });
        const newFactory = factory[method](middleware);
        expect(newFactory["middlewares"].length).toBe(1);
        const requestMock = { body: { something: "awesome" } } as Request;
        const responseMock = {} as Response;
        const options = await newFactory["middlewares"][0].middleware({
          input: {},
          options: {},
          request: requestMock,
          response: responseMock,
          logger: {} as AbstractLogger,
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
        expectType<{}>(options);
      });

      test("Should handle errors", async () => {
        const resultHandlerMock = createResultHandler({
          getPositiveResponse: () => z.string(),
          getNegativeResponse: () => z.string(),
          handler: vi.fn(),
        });
        const factory = new EndpointsFactory(resultHandlerMock);
        const middleware: RequestHandler = vi.fn(({}, {}, next) => {
          next(new Error("This one has failed"));
        });
        const newFactory = factory[method](middleware);
        try {
          await newFactory["middlewares"][0].middleware({
            input: {},
            options: {},
            request: {} as Request,
            response: {} as Response,
            logger: {} as AbstractLogger,
          });
          expect.fail("Should not be here");
        } catch (e) {
          expect(middleware).toHaveBeenCalledTimes(1);
          expect(e).toBeInstanceOf(Error);
          if (e instanceof Error) {
            expect(e.message).toBe("This one has failed");
          }
        }
      });

      test("Should transform errors", async () => {
        const resultHandlerMock = createResultHandler({
          getPositiveResponse: () => z.string(),
          getNegativeResponse: () => z.string(),
          handler: vi.fn(),
        });
        const factory = new EndpointsFactory(resultHandlerMock);
        const middleware: RequestHandler = vi.fn(({}, {}, next) => {
          next(new Error("This one has failed"));
        });
        const newFactory = factory[method](middleware, {
          transformer: (err) => createHttpError(401, err.message),
        });
        try {
          await newFactory["middlewares"][0].middleware({
            input: {},
            options: {},
            request: {} as Request,
            response: {} as Response,
            logger: {} as AbstractLogger,
          });
          expect.fail("Should not be here");
        } catch (e) {
          expect(middleware).toHaveBeenCalledTimes(1);
          expect(e).toBeInstanceOf(HttpError);
          if (e instanceof HttpError) {
            expect(e.status).toBe(401);
            expect(e.message).toBe("This one has failed");
          }
        }
      });
    },
  );

  describe(".build()", () => {
    test("Should create an endpoint with simple middleware", () => {
      const middleware = createMiddleware({
        input: z.object({
          n: z.number(),
        }),
        middleware: vi.fn(),
      });
      const resultHandlerMock = createResultHandler({
        getPositiveResponse: () => z.string(),
        getNegativeResponse: () => z.string(),
        handler: vi.fn(),
      });
      const factory = new EndpointsFactory(resultHandlerMock).addMiddleware(
        middleware,
      );
      const handlerMock = vi.fn();
      const endpoint = factory.build({
        method: "get",
        input: z.object({
          s: z.string(),
        }),
        output: z.object({
          b: z.boolean(),
        }),
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
      expectType<
        z.ZodIntersection<
          z.ZodObject<{ n: z.ZodNumber }>,
          z.ZodObject<{ s: z.ZodString }>
        >
      >(endpoint.getSchema("input"));
    });

    test("Should create an endpoint with refined object middleware", () => {
      const middleware = createMiddleware({
        input: z
          .object({
            a: z.number().optional(),
            b: z.string().optional(),
          })
          .refine((props) => Object.keys(props).length, {
            message: "Should be at least one option specified",
          }),
        middleware: vi.fn(),
      });
      const resultHandlerMock = createResultHandler({
        getPositiveResponse: () => z.string(),
        getNegativeResponse: () => z.string(),
        handler: vi.fn(),
      });
      const factory = new EndpointsFactory(resultHandlerMock).addMiddleware(
        middleware,
      );
      const endpoint = factory.build({
        method: "get",
        input: z.object({
          i: z.string(),
        }),
        output: z.object({
          o: z.boolean(),
        }),
        handler: vi.fn(),
      });
      expect(
        serializeSchemaForTest(endpoint.getSchema("input")),
      ).toMatchSnapshot();
      expect(
        serializeSchemaForTest(endpoint.getSchema("output")),
      ).toMatchSnapshot();
      expectType<
        z.ZodIntersection<
          z.ZodEffects<
            z.ZodObject<{
              a: z.ZodOptional<z.ZodNumber>;
              b: z.ZodOptional<z.ZodString>;
            }>
          >,
          z.ZodObject<{ i: z.ZodString }>
        >
      >(endpoint.getSchema("input"));
    });

    test("Should create an endpoint with intersection middleware", () => {
      const middleware = createMiddleware({
        input: z
          .object({
            n1: z.number(),
          })
          .and(
            z.object({
              n2: z.number(),
            }),
          ),
        middleware: vi.fn(),
      });
      const resultHandlerMock = createResultHandler({
        getPositiveResponse: () => z.string(),
        getNegativeResponse: () => z.string(),
        handler: vi.fn(),
      });
      const factory = new EndpointsFactory(resultHandlerMock).addMiddleware(
        middleware,
      );
      const handlerMock = vi.fn();
      const endpoint = factory.build({
        methods: ["get"],
        input: z.object({
          s: z.string(),
        }),
        output: z.object({
          b: z.boolean(),
        }),
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
      expectType<
        z.ZodIntersection<
          z.ZodIntersection<
            z.ZodObject<{ n1: z.ZodNumber }>,
            z.ZodObject<{ n2: z.ZodNumber }>
          >,
          z.ZodObject<{ s: z.ZodString }>
        >
      >(endpoint.getSchema("input"));
    });

    test("Should create an endpoint with union middleware", () => {
      const middleware = createMiddleware({
        input: z
          .object({
            n1: z.number(),
          })
          .or(
            z.object({
              n2: z.number(),
            }),
          ),
        middleware: vi.fn(),
      });
      const resultHandlerMock = createResultHandler({
        getPositiveResponse: () => z.string(),
        getNegativeResponse: () => z.string(),
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
        methods: ["get"],
        input: z.object({
          s: z.string(),
        }),
        output: z.object({
          b: z.boolean(),
        }),
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
      expectType<
        z.ZodIntersection<
          z.ZodUnion<
            [z.ZodObject<{ n1: z.ZodNumber }>, z.ZodObject<{ n2: z.ZodNumber }>]
          >,
          z.ZodObject<{ s: z.ZodString }>
        >
      >(endpoint.getSchema("input"));
    });
  });
});
