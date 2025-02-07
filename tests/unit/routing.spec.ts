import {
  appMock,
  expressMock,
  staticHandler,
  staticMock,
} from "../express-mock";
import { z } from "zod";
import {
  DependsOnMethod,
  CommonConfig,
  EndpointsFactory,
  Routing,
  ServeStatic,
  defaultResultHandler,
  ez,
} from "../../express-zod-api/src";
import {
  makeLoggerMock,
  makeRequestMock,
  makeResponseMock,
} from "../../express-zod-api/src/testing";
import { createWrongMethodHandler, initRouting } from "../../express-zod-api/src/routing";
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

    test.each([404, 405])(
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
          config: configMock as CommonConfig,
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
      const configMock = {
        cors: true,
        startupLogo: false,
      };
      const logger = makeLoggerMock();
      initRouting({
        app: appMock as unknown as IRouter,
        getLogger: () => logger,
        config: configMock as CommonConfig,
        routing,
      });
      expect(staticMock).toHaveBeenCalledWith(__dirname, { dotfiles: "deny" });
      expect(appMock.use).toHaveBeenCalledTimes(1);
      expect(appMock.use).toHaveBeenCalledWith("/public", staticHandler);
    });

    test("Should accept DependsOnMethod", () => {
      const handlerMock = vi.fn();
      const configMock = {
        cors: true,
        startupLogo: false,
      };
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
          user: new DependsOnMethod({
            get: getEndpoint,
            post: postEndpoint,
            put: putAndPatchEndpoint,
            patch: putAndPatchEndpoint,
          }),
        },
      };
      const logger = makeLoggerMock();
      initRouting({
        app: appMock as unknown as IRouter,
        getLogger: () => logger,
        config: configMock as CommonConfig,
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

    test("Should check if endpoint supports the method it's assigned to within DependsOnMethod", () => {
      const configMock = { cors: true, startupLogo: false };
      const factory = new EndpointsFactory(defaultResultHandler);
      const putAndPatchEndpoint = factory.build({
        method: ["put", "patch"],
        output: z.object({}),
        handler: vi.fn(),
      });
      const routing: Routing = {
        v1: {
          user: new DependsOnMethod({
            put: putAndPatchEndpoint,
            patch: putAndPatchEndpoint,
            post: putAndPatchEndpoint, // intentional
          }),
        },
      };
      const logger = makeLoggerMock();
      expect(() =>
        initRouting({
          app: appMock as unknown as IRouter,
          getLogger: () => logger,
          config: configMock as CommonConfig,
          routing,
        }),
      ).toThrowErrorMatchingSnapshot();
    });

    test("Issue 705: should set all DependsOnMethod' methods for CORS", async () => {
      const handler = vi.fn(async () => ({}));
      const configMock = {
        cors: (params: { defaultHeaders: Record<string, string> }) => ({
          ...params.defaultHeaders,
          "X-Custom-Header": "Testing",
        }),
        startupLogo: false,
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
        hello: new DependsOnMethod({
          get: getEndpoint,
          post: postEndpoint,
          put: putAndPatchEndpoint,
          patch: putAndPatchEndpoint,
        }),
      };
      const logger = makeLoggerMock();
      initRouting({
        app: appMock as unknown as IRouter,
        getLogger: () => logger,
        config: configMock as CommonConfig,
        routing,
      });
      expect(appMock.options).toHaveBeenCalledTimes(1);
      expect(appMock.options.mock.calls[0][0]).toBe("/hello");
      const fn = appMock.options.mock.calls[0][1];
      expect(typeof fn).toBe("function"); // async (req, res) => void
      const requestMock = makeRequestMock({ method: "PUT" });
      const responseMock = makeResponseMock();
      await fn(requestMock, responseMock);
      expect(responseMock._getStatusCode()).toBe(200);
      expect(responseMock._getHeaders()).toEqual({
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, POST, PUT, PATCH, OPTIONS",
        "access-control-allow-headers": "content-type",
        "content-type": "application/json",
        "x-custom-header": "Testing",
      });
    });

    test("Should accept parameters", () => {
      const handlerMock = vi.fn();
      const configMock = { startupLogo: false };
      const endpointMock = new EndpointsFactory(defaultResultHandler).build({
        output: z.object({}),
        handler: handlerMock,
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
        config: configMock as CommonConfig,
        routing,
      });
      expect(appMock.get).toHaveBeenCalledTimes(1);
      expect(appMock.get.mock.calls[0][0]).toBe("/v1/user/:id");
    });

    test("Should handle empty paths and trim spaces", () => {
      const handlerMock = vi.fn();
      const configMock = { startupLogo: false };
      const endpointMock = new EndpointsFactory(defaultResultHandler).build({
        output: z.object({}),
        handler: handlerMock,
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
        config: configMock as CommonConfig,
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

    test("Should throw an error in case of slashes in route", () => {
      const handlerMock = vi.fn();
      const configMock = { startupLogo: false };
      const endpointMock = new EndpointsFactory(defaultResultHandler).build({
        output: z.object({}),
        handler: handlerMock,
      });
      const logger = makeLoggerMock();
      expect(() =>
        initRouting({
          app: appMock as unknown as IRouter,
          getLogger: () => logger,
          config: configMock as CommonConfig,
          routing: {
            v1: {
              "user/retrieve": endpointMock,
            },
          },
        }),
      ).toThrowErrorMatchingSnapshot();
      expect(() =>
        initRouting({
          app: appMock as unknown as IRouter,
          getLogger: () => logger,
          config: configMock as CommonConfig,
          routing: {
            "v1/user/retrieve": endpointMock,
          },
        }),
      ).toThrowErrorMatchingSnapshot();
    });

    test("Should execute endpoints with right arguments", async () => {
      const handlerMock = vi
        .fn()
        .mockImplementationOnce(() => ({ result: true }));
      const configMock = { cors: true, startupLogo: false };
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
        config: configMock as CommonConfig,
        routing,
      });
      expect(appMock.post).toHaveBeenCalledTimes(1);
      const routeHandler = appMock.post.mock.calls[0][1] as RequestHandler;
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

    test.each([
      [z.bigint(), z.set(z.string())],
      [z.nan(), z.map(z.string(), z.boolean())],
      [z.date().pipe(z.string()), z.symbol().catch(Symbol("test"))],
      [z.function().transform(() => "test"), z.tuple([z.function()])],
      [ez.dateOut(), ez.dateIn()],
      [z.lazy(() => z.void()), ez.raw()],
      [z.promise(z.any()), ez.upload()],
      [z.never(), z.tuple([ez.file()]).rest(z.nan())],
    ])("should warn about JSON incompatible schemas %#", (input, output) => {
      const endpoint = new EndpointsFactory(defaultResultHandler).build({
        input: z.object({ input }),
        output: z.object({ output }),
        handler: vi.fn(),
      });
      const configMock = { cors: false, startupLogo: false };
      const logger = makeLoggerMock();
      initRouting({
        app: appMock as unknown as IRouter,
        getLogger: () => logger,
        config: configMock as CommonConfig,
        routing: { path: endpoint },
      });
      expect(logger._getLogs().warn).toEqual([
        [
          "The final input schema of the endpoint contains an unsupported JSON payload type.",
          { method: "get", path: "/path", reason: expect.any(Error) },
        ],
        [
          "The final positive response schema of the endpoint contains an unsupported JSON payload type.",
          { method: "get", path: "/path", reason: expect.any(Error) },
        ],
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
