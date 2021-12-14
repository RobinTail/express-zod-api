import { Request, Response } from "express";
import { Logger } from "winston";
import { createMiddleware, EndpointsFactory, z } from "../../src";
import { Endpoint } from "../../src/endpoint";
import { ResultHandlerDefinition } from "../../src/result-handler";
import { expectType } from "tsd";
import { serializeSchemaForTest } from "../helpers";

describe("EndpointsFactory", () => {
  /* eslint-disable @typescript-eslint/dot-notation */

  describe(".constructor()", () => {
    test("Should create the empty factory with result handler", () => {
      const resultHandlerMock = { handler: jest.fn() };
      const factory = new EndpointsFactory(
        resultHandlerMock as unknown as ResultHandlerDefinition<any, any>
      );
      expect(factory).toBeInstanceOf(EndpointsFactory);
      expect(factory["middlewares"]).toStrictEqual([]);
      expect(factory["resultHandler"]).toStrictEqual(resultHandlerMock);
    });

    test("Should create the factory with middleware and result handler", () => {
      const middleware = createMiddleware({
        input: z.object({
          n: z.number(),
        }),
        middleware: jest.fn(),
      });
      const resultHandlerMock = { handler: jest.fn() };
      const factory = new EndpointsFactory(
        resultHandlerMock as unknown as ResultHandlerDefinition<any, any>
      ).addMiddleware(middleware);
      expect(factory["middlewares"]).toStrictEqual([middleware]);
      expect(factory["resultHandler"]).toStrictEqual(resultHandlerMock);
    });
  });

  describe(".addMiddleware()", () => {
    test("Should create a new factory with a middleware and the same result handler", () => {
      const resultHandlerMock = { handler: jest.fn() };
      const factory = new EndpointsFactory(
        resultHandlerMock as unknown as ResultHandlerDefinition<any, any>
      );
      const middleware = createMiddleware({
        input: z.object({
          n: z.number(),
        }),
        middleware: jest.fn(),
      });
      const newFactory = factory.addMiddleware(middleware);
      expect(factory["middlewares"]).toStrictEqual([]);
      expect(factory["resultHandler"]).toStrictEqual(resultHandlerMock);
      expect(newFactory["middlewares"]).toStrictEqual([middleware]);
      expect(newFactory["resultHandler"]).toStrictEqual(resultHandlerMock);
    });
  });

  describe(".addOptions()", () => {
    test("Should create a new factory with an empty-input middleware and the same result handler", async () => {
      const resultHandlerMock = { handler: jest.fn() };
      const factory = new EndpointsFactory(
        resultHandlerMock as unknown as ResultHandlerDefinition<any, any>
      );
      const newFactory = factory.addOptions({
        option1: "some value",
        option2: "other value",
      });
      expect(factory["middlewares"]).toStrictEqual([]);
      expect(factory["resultHandler"]).toStrictEqual(resultHandlerMock);
      expect(newFactory["middlewares"].length).toBe(1);
      expect(newFactory["middlewares"][0].input).toBeInstanceOf(z.ZodObject);
      expect(newFactory["middlewares"][0].input.shape).toEqual({});
      expect(
        await newFactory["middlewares"][0].middleware({
          input: {},
          options: {},
          request: {} as Request,
          response: {} as Response,
          logger: {} as Logger,
        })
      ).toEqual({
        option1: "some value",
        option2: "other value",
      });
      expect(newFactory["resultHandler"]).toStrictEqual(resultHandlerMock);
    });
  });

  describe(".build()", () => {
    test("Should create an endpoint with simple middleware", () => {
      const middleware = createMiddleware({
        input: z.object({
          n: z.number(),
        }),
        middleware: jest.fn(),
      });
      const resultHandlerMock = { handler: jest.fn() };
      const factory = new EndpointsFactory(
        resultHandlerMock as unknown as ResultHandlerDefinition<any, any>
      ).addMiddleware(middleware);
      const handlerMock = jest.fn();
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
      expect(endpoint["middlewares"]).toStrictEqual([middleware]);
      expect(serializeSchemaForTest(endpoint["inputSchema"])).toMatchSnapshot();
      expect(
        serializeSchemaForTest(endpoint["outputSchema"])
      ).toMatchSnapshot();
      expect(endpoint["handler"]).toStrictEqual(handlerMock);
      expect(endpoint["resultHandler"]).toStrictEqual(resultHandlerMock);
      expectType<{
        n: z.ZodNumber;
        s: z.ZodString;
      }>(endpoint["inputSchema"].shape);
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
            })
          ),
        middleware: jest.fn(),
      });
      const resultHandlerMock = { handler: jest.fn() };
      const factory = new EndpointsFactory(
        resultHandlerMock as unknown as ResultHandlerDefinition<any, any>
      ).addMiddleware(middleware);
      const handlerMock = jest.fn();
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
      expect(endpoint["middlewares"]).toStrictEqual([middleware]);
      expect(serializeSchemaForTest(endpoint["inputSchema"])).toMatchSnapshot();
      expect(
        serializeSchemaForTest(endpoint["outputSchema"])
      ).toMatchSnapshot();
      expect(endpoint["handler"]).toStrictEqual(handlerMock);
      expect(endpoint["resultHandler"]).toStrictEqual(resultHandlerMock);
      expectType<{
        n1: z.ZodNumber;
        n2: z.ZodNumber;
        s: z.ZodString;
      }>(endpoint["inputSchema"].shape);
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
            })
          ),
        middleware: jest.fn(),
      });
      const resultHandlerMock = { handler: jest.fn() };
      const factory = new EndpointsFactory(
        resultHandlerMock as unknown as ResultHandlerDefinition<any, any>
      ).addMiddleware(middleware);
      const handlerMock = jest.fn().mockImplementation((params) => ({
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
      expect(endpoint["middlewares"]).toStrictEqual([middleware]);
      expect(serializeSchemaForTest(endpoint["inputSchema"])).toMatchSnapshot();
      expect(
        serializeSchemaForTest(endpoint["outputSchema"])
      ).toMatchSnapshot();
      expect(endpoint["handler"]).toStrictEqual(handlerMock);
      expect(endpoint["resultHandler"]).toStrictEqual(resultHandlerMock);
      expectType<
        (
          | {
              n1: z.ZodNumber;
            }
          | {
              n2: z.ZodNumber;
            }
        ) & {
          s: z.ZodString;
        }
      >(endpoint["inputSchema"].shape);
      expectType<{
        n1?: z.ZodNumber;
        n2?: z.ZodNumber;
        s: z.ZodString;
      }>(endpoint["inputSchema"].shape);
    });
  });
});
