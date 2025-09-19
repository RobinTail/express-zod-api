import {
  appMock,
  expressMock,
  staticHandler,
  staticMock,
} from "./express-mock";
import { z } from "zod";
import {
  EndpointsFactory,
  Routing,
  ServeStatic,
  defaultResultHandler,
  ez,
} from "../src";
import {
  makeLoggerMock,
  makeRequestMock,
  makeResponseMock,
} from "../src/testing";
import { createWrongMethodHandler, initRouting } from "../src/routing";
import type { IRouter, RequestHandler } from "express";
import createHttpError from "http-errors";

describe("Routing", () => {
  describe("initRouting()", () => {
    beforeAll(() => {
      expressMock();
    });

    beforeEach(() => {
      vi.clearAllMocks(); // resets call counters on mocked methods
    });

    test.each([404, 405] as const)(
      "Should set right methods %#",
      (wrongMethodBehavior) => {
        const handlerMock = vi.fn();
        const configMock = {
          cors: true,
          startupLogo: false,
          wrongMethodBehavior,
        };
        const factory = new EndpointsFactory(defaultResultHandler);
        const getEndpoint = factory.build({
          output: z.object({}),
          handler: handlerMock,
        });
        const postEndpoint = factory.build({
          method: "post",
          output: z.object({}),
          handler: handlerMock,
        });
        const getAndPostEndpoint = factory.build({
          method: ["get", "post"],
          output: z.object({}),
          handler: handlerMock,
        });
        const routing: Routing = {
          v1: {
            user: {
              get: getEndpoint,
              set: postEndpoint,
              universal: getAndPostEndpoint,
            },
          },
        };
        const logger = makeLoggerMock();
        initRouting({
          app: appMock as unknown as IRouter,
          getLogger: () => logger,
          config: configMock,
          routing,
        });
        expect(appMock.get).toHaveBeenCalledTimes(2);
        expect(appMock.post).toHaveBeenCalledTimes(2);
        expect(appMock.put).toHaveBeenCalledTimes(0);
        expect(appMock.delete).toHaveBeenCalledTimes(0);
        expect(appMock.patch).toHaveBeenCalledTimes(0);
        expect(appMock.options).toHaveBeenCalledTimes(3);
        expect(appMock.get.mock.calls[0][0]).toBe("/v1/user/get");
        expect(appMock.get.mock.calls[1][0]).toBe("/v1/user/universal");
        expect(appMock.post.mock.calls[0][0]).toBe("/v1/user/set");
        expect(appMock.post.mock.calls[1][0]).toBe("/v1/user/universal");
        expect(appMock.options.mock.calls[0][0]).toBe("/v1/user/get");
        expect(appMock.options.mock.calls[1][0]).toBe("/v1/user/set");
        expect(appMock.options.mock.calls[2][0]).toBe("/v1/user/universal");
        if (wrongMethodBehavior !== 405) return;
        expect(appMock.all).toHaveBeenCalledTimes(3);
        expect(appMock.all.mock.calls[0][0]).toBe("/v1/user/get");
        expect(appMock.all.mock.calls[1][0]).toBe("/v1/user/set");
        expect(appMock.all.mock.calls[2][0]).toBe("/v1/user/universal");
      },
    );

    test("Should accept serveStatic", () => {
      const routing: Routing = {
        public: new ServeStatic(__dirname, { dotfiles: "deny" }),
      };
      const logger = makeLoggerMock();
      initRouting({
        app: appMock as unknown as IRouter,
        getLogger: () => logger,
        config: { cors: true },
        routing,
      });
      expect(staticMock).toHaveBeenCalledWith(__dirname, { dotfiles: "deny" });
      expect(appMock.use).toHaveBeenCalledTimes(1);
      expect(appMock.use).toHaveBeenCalledWith("/public", staticHandler);
    });

    test("Should handle method depending assignments", () => {
      const handlerMock = vi.fn();
      const factory = new EndpointsFactory(defaultResultHandler);
      const getEndpoint = factory.build({
        output: z.object({}),
        handler: handlerMock,
      });
      const postEndpoint = factory.build({
        output: z.object({}),
        handler: handlerMock,
      });
      const putAndPatchEndpoint = factory.build({
        output: z.object({}),
        handler: handlerMock,
      });
      const routing: Routing = {
        v1: {
          user: {
            "get /": getEndpoint,
            "post /": postEndpoint,
            "put /": putAndPatchEndpoint,
            "patch /": putAndPatchEndpoint,
          },
        },
      };
      const logger = makeLoggerMock();
      initRouting({
        app: appMock as unknown as IRouter,
        getLogger: () => logger,
        config: { cors: true },
        routing,
      });
      expect(appMock.get).toHaveBeenCalledTimes(1);
      expect(appMock.post).toHaveBeenCalledTimes(1);
      expect(appMock.put).toHaveBeenCalledTimes(1);
      expect(appMock.patch).toHaveBeenCalledTimes(1);
      expect(appMock.delete).toHaveBeenCalledTimes(0);
      expect(appMock.options).toHaveBeenCalledTimes(1);
      expect(appMock.get.mock.calls[0][0]).toBe("/v1/user");
      expect(appMock.post.mock.calls[0][0]).toBe("/v1/user");
      expect(appMock.put.mock.calls[0][0]).toBe("/v1/user");
      expect(appMock.patch.mock.calls[0][0]).toBe("/v1/user");
      expect(appMock.options.mock.calls[0][0]).toBe("/v1/user");
    });

    test("Should check if endpoint supports the method it's assigned to", () => {
      const factory = new EndpointsFactory(defaultResultHandler);
      const putAndPatchEndpoint = factory.build({
        method: ["put", "patch"],
        output: z.object({}),
        handler: vi.fn(),
      });
      const routing: Routing = {
        v1: {
          user: {
            "put /": putAndPatchEndpoint,
            "patch /": putAndPatchEndpoint,
            "post /": putAndPatchEndpoint, // intentional
          },
        },
      };
      const logger = makeLoggerMock();
      expect(() =>
        initRouting({
          app: appMock as unknown as IRouter,
          getLogger: () => logger,
          config: { cors: true },
          routing,
        }),
      ).toThrowErrorMatchingSnapshot();
    });

    test("Issue 705: should set all assigned methods to CORS response header", async () => {
      const handler = vi.fn(async () => ({}));
      const configMock = {
        cors: (params: { defaultHeaders: Record<string, string> }) => ({
          ...params.defaultHeaders,
          "X-Custom-Header": "Testing",
        }),
      };
      const factory = new EndpointsFactory(defaultResultHandler);
      const input = z.object({});
      const output = z.object({});
      const getEndpoint = factory.build({
        input,
        output,
        handler,
      });
      const postEndpoint = factory.build({
        input,
        output,
        handler,
      });
      const putAndPatchEndpoint = factory.build({
        input,
        output,
        handler,
      });
      const routing: Routing = {
        hello: {
          "get /": getEndpoint,
          "post /": postEndpoint,
          "put /": putAndPatchEndpoint,
          "patch /": putAndPatchEndpoint,
        },
      };
      const logger = makeLoggerMock();
      initRouting({
        app: appMock as unknown as IRouter,
        getLogger: () => logger,
        config: configMock,
        routing,
      });
      expect(appMock.options).toHaveBeenCalledTimes(1);
      expect(appMock.options.mock.calls[0][0]).toBe("/hello");
      const fn = appMock.options.mock.calls[0][1];
      expect(typeof fn).toBe("function"); // async RequestHandler, proprietary CORS middleware
      const requestMock = makeRequestMock({ method: "PUT" });
      const responseMock = makeResponseMock();
      await fn(requestMock, responseMock, vi.fn());
      expect(responseMock._getStatusCode()).toBe(200);
      expect(responseMock._getHeaders()).toEqual({
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, PATCH, POST, PUT, HEAD, OPTIONS",
        "access-control-allow-headers": "content-type",
        "x-custom-header": "Testing",
      });
    });

    test("Should accept parameters", () => {
      const endpointMock = new EndpointsFactory(defaultResultHandler).build({
        output: z.object({}),
        handler: vi.fn(),
      });
      const routing: Routing = {
        v1: {
          user: {
            ":id": endpointMock,
          },
        },
      };
      const logger = makeLoggerMock();
      initRouting({
        app: appMock as unknown as IRouter,
        getLogger: () => logger,
        config: { cors: false },
        routing,
      });
      expect(appMock.get).toHaveBeenCalledTimes(1);
      expect(appMock.get.mock.calls[0][0]).toBe("/v1/user/:id");
    });

    test("Should handle empty paths and trim spaces", () => {
      const endpointMock = new EndpointsFactory(defaultResultHandler).build({
        output: z.object({}),
        handler: vi.fn(),
      });
      const routing: Routing = {
        v1: {
          user: {
            ":id": endpointMock.nest({
              " download ": endpointMock,
            }),
          },
        },
      };
      const logger = makeLoggerMock();
      initRouting({
        app: appMock as unknown as IRouter,
        getLogger: () => logger,
        config: { cors: false },
        routing,
      });
      expect(appMock.get).toHaveBeenCalledTimes(2);
      expect(appMock.get).toHaveBeenCalledWith(
        "/v1/user/:id",
        expect.any(Function),
      );
      expect(appMock.get).toHaveBeenCalledWith(
        "/v1/user/:id/download",
        expect.any(Function),
      );
    });

    test("Should handle slashes in routing keys", () => {
      const endpointMock = new EndpointsFactory(defaultResultHandler).build({
        output: z.object({}),
        handler: vi.fn(),
      });
      const logger = makeLoggerMock();
      initRouting({
        app: appMock as unknown as IRouter,
        getLogger: () => logger,
        config: { cors: false },
        routing: {
          v1: { "///user/retrieve///": endpointMock },
          "v1/user/delete": endpointMock,
        },
      });
      expect(appMock.get).toHaveBeenCalledTimes(2);
      expect(appMock.get).toHaveBeenCalledWith(
        "/v1/user/retrieve",
        expect.any(Function),
      );
      expect(appMock.get).toHaveBeenCalledWith(
        "/v1/user/delete",
        expect.any(Function),
      );
    });

    test("Should handle explicitly specified method", async () => {
      const endpoint = new EndpointsFactory(defaultResultHandler).buildVoid({
        handler: vi.fn(),
      });
      const logger = makeLoggerMock();
      initRouting({
        app: appMock as unknown as IRouter,
        getLogger: () => logger,
        config: { cors: true },
        routing: {
          v1: {
            "get ///user/retrieve///": endpoint,
            user: {
              "post retrieve": endpoint,
            },
          },
        },
      });
      expect(appMock.get).toHaveBeenCalledOnce();
      expect(appMock.get).toHaveBeenCalledWith(
        "/v1/user/retrieve",
        expect.any(Function), // cors
        expect.any(Function), // endpoint
      );
      expect(appMock.post).toHaveBeenCalledOnce();
      expect(appMock.post).toHaveBeenCalledWith(
        "/v1/user/retrieve",
        expect.any(Function), // cors
        expect.any(Function), // endpoint
      );
      expect(appMock.options).toHaveBeenCalledTimes(1);
      expect(appMock.options.mock.calls[0]).toEqual([
        "/v1/user/retrieve",
        expect.any(Function), // cors
        expect.any(Function), // endpoint
      ]);
      const fn = appMock.options.mock.calls[0][1]; // similar to issue 705
      const requestMock = makeRequestMock({ method: "POST" });
      const responseMock = makeResponseMock();
      await fn(requestMock, responseMock, vi.fn());
      expect(responseMock._getStatusCode()).toBe(200);
      expect(responseMock._getHeaders()).toEqual({
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, POST, HEAD, OPTIONS",
        "access-control-allow-headers": "content-type",
      });
    });

    test("Should check if endpoint supports an explicitly specified method", () => {
      const endpointMock = new EndpointsFactory(defaultResultHandler).build({
        method: "post",
        output: z.object({}),
        handler: vi.fn(),
      });
      const logger = makeLoggerMock();
      expect(() =>
        initRouting({
          app: appMock as unknown as IRouter,
          getLogger: () => logger,
          config: { cors: false },
          routing: {
            v1: {
              "get ///user/retrieve///": endpointMock,
            },
          },
        }),
      ).toThrowErrorMatchingSnapshot();
    });

    test("Should prohibit nested routing within a route having explicit method", () => {
      const endpointMock = new EndpointsFactory(defaultResultHandler).build({
        output: z.object({}),
        handler: vi.fn(),
      });
      const logger = makeLoggerMock();
      expect(() =>
        initRouting({
          app: appMock as unknown as IRouter,
          getLogger: () => logger,
          config: { cors: false },
          routing: {
            v1: {
              "get ///user/retrieve///": { another: endpointMock },
            },
          },
        }),
      ).toThrowErrorMatchingSnapshot();
    });

    test("Should prohibit nesting for a route having explicit method", () => {
      const logger = makeLoggerMock();
      expect(() =>
        initRouting({
          app: appMock as unknown as IRouter,
          getLogger: () => logger,
          config: { cors: false },
          routing: {
            v1: {
              "get /user/retrieve": {},
            },
          },
        }),
      ).toThrowErrorMatchingSnapshot();
    });

    test("Should prohibit ServeStatic for a route having explicit method", () => {
      const logger = makeLoggerMock();
      expect(() =>
        initRouting({
          app: appMock as unknown as IRouter,
          getLogger: () => logger,
          config: { cors: false },
          routing: {
            v1: {
              "get /user/retrieve": new ServeStatic("."),
            },
          },
        }),
      ).toThrowErrorMatchingSnapshot();
    });

    test("Should prohibit duplicated routes", () => {
      const logger = makeLoggerMock();
      const endpointMock = new EndpointsFactory(defaultResultHandler).build({
        output: z.object({}),
        handler: vi.fn(),
      });
      const routing: Routing = {
        v1: { test: endpointMock },
        "/v1/test": endpointMock,
      };
      expect(() =>
        initRouting({
          app: appMock as unknown as IRouter,
          getLogger: () => logger,
          config: { cors: false },
          routing,
        }),
      ).toThrowErrorMatchingSnapshot();
    });

    test("Should execute endpoints with right arguments", async () => {
      const handlerMock = vi
        .fn()
        .mockImplementationOnce(() => ({ result: true }));
      const setEndpoint = new EndpointsFactory(defaultResultHandler).build({
        method: "post",
        input: z.object({ test: z.number() }),
        output: z.object({ result: z.boolean() }),
        handler: handlerMock,
      });
      const routing: Routing = {
        v1: {
          user: {
            set: setEndpoint,
          },
        },
      };
      const getLoggerMock = vi.fn(() => makeLoggerMock());
      initRouting({
        app: appMock as unknown as IRouter,
        getLogger: getLoggerMock,
        config: { cors: true },
        routing,
      });
      expect(appMock.post).toHaveBeenCalledTimes(1);
      const routeHandler = appMock.post.mock.calls[0][2] as RequestHandler; // 1 is CORS
      const requestMock = makeRequestMock({
        method: "POST",
        body: { test: 123 },
      });
      const responseMock = makeResponseMock();
      const nextMock = vi.fn();
      await routeHandler(requestMock, responseMock, nextMock);
      expect(getLoggerMock).toHaveBeenCalledWith(requestMock);
      expect(nextMock).toHaveBeenCalledTimes(0);
      expect(handlerMock).toHaveBeenCalledTimes(1);
      expect(
        getLoggerMock.mock.results.pop()!.value._getLogs().error,
      ).toHaveLength(0);
      expect(handlerMock).toHaveBeenCalledWith({
        input: { test: 123 },
        options: {},
        logger: getLoggerMock.mock.results.pop()!.value,
      });
      expect(responseMock._getStatusCode()).toBe(200);
      expect(responseMock._getJSONData()).toEqual({
        status: "success",
        data: { result: true },
      });
    });

    const circular: z.ZodType = z.lazy(() => z.tuple([circular, z.nan()]));
    test.each([
      [z.bigint(), z.set(z.string())],
      [z.nan(), z.map(z.string(), z.boolean())],
      [
        z.date().transform(String).pipe(z.string()),
        z.symbol().catch(Symbol("test")),
      ],
      [ez.dateOut(), ez.dateIn()],
      [z.lazy(() => z.void()), ez.raw()],
      [z.promise(z.any()), ez.upload()],
      [z.never(), z.tuple([ez.buffer()]).rest(z.nan())],
      [ez.buffer().pipe(z.any()), circular],
    ])("should warn about JSON incompatible schemas %#", (input, output) => {
      const endpoint = new EndpointsFactory(defaultResultHandler).build({
        input: z.object({ input }),
        output: z.object({ output }),
        handler: vi.fn(),
      });
      const logger = makeLoggerMock();
      initRouting({
        app: appMock as unknown as IRouter,
        getLogger: () => logger,
        config: { cors: false },
        routing: { path: endpoint },
      });
      expect(logger._getLogs().warn).toEqual([
        [
          "The final input schema of the endpoint contains an unsupported JSON payload type.",
          { method: "get", path: "/path", reason: expect.any(z.ZodType) },
        ],
        [
          "The final positive response schema of the endpoint contains an unsupported JSON payload type.",
          { method: "get", path: "/path", reason: expect.any(z.ZodType) },
        ],
      ]);
    });

    test.each([
      [z.string().array(), z.string()],
      [
        z.lazy(() => z.number()),
        z.record(z.number(), z.string()).pipe(z.array(z.string())),
      ],
    ])("should warn about non-object based schemas I/O %#", (input, output) => {
      const endpoint = new EndpointsFactory(defaultResultHandler).build({
        input: input as unknown as z.ZodObject,
        output: output as unknown as z.ZodObject,
        handler: vi.fn(),
      });
      const logger = makeLoggerMock();
      initRouting({
        app: appMock as unknown as IRouter,
        getLogger: () => logger,
        config: { cors: false },
        routing: { path: endpoint },
      });
      expect(logger._getLogs().warn).toEqual([
        [
          "Endpoint input schema is not object-based",
          { method: "get", path: "/path" },
        ],
        [
          "Endpoint output schema is not object-based",
          { method: "get", path: "/path" },
        ],
      ]);
    });

    test.each([
      z.object({ id: z.string() }),
      z.record(z.literal("id"), z.string()),
    ])("should warn about unused path params %#", (input) => {
      const endpoint = new EndpointsFactory(defaultResultHandler).build({
        input,
        output: z.object({}),
        handler: vi.fn(),
      });
      const logger = makeLoggerMock();
      initRouting({
        app: appMock as unknown as IRouter,
        getLogger: () => logger,
        config: { cors: false },
        routing: { v1: { ":idx": endpoint } },
      });
      expect(logger._getLogs().warn).toContainEqual([
        "The input schema of the endpoint is most likely missing the parameter of the path it's assigned to.",
        { method: "get", param: "idx", path: "/v1/:idx" },
      ]);
    });
  });

  describe("createWrongMethodHandler", () => {
    test("should call forward 405 error with a header having list of allowed methods", () => {
      const handler = createWrongMethodHandler(["post", "options"]);
      const nextMock = vi.fn();
      const resMock = makeResponseMock();
      handler(makeRequestMock(), resMock, nextMock);
      expect(resMock._getHeaders()).toHaveProperty("allow", "POST, OPTIONS");
      expect(nextMock).toHaveBeenCalledWith(
        createHttpError(405, "GET is not allowed", {
          headers: { Allow: "POST, OPTIONS" },
        }),
      );
    });
  });
});
