import { staticHandler, staticMock } from "../mocks/express-mock";
import { Logger } from "winston";
import { z } from "zod";
import {
  DependsOnMethod,
  EndpointsFactory,
  Routing,
  ServeStatic,
  defaultResultHandler,
} from "./index";
import { CommonConfig } from "./index";
import { mimeJson } from "./mime";
import { makeRequestMock, makeResponseMock } from "./testing";
import { initRouting } from "./routing";
import type { Express, Request, RequestHandler, Response } from "express";

let appMock: any;
let loggerMock: any;

describe("Routing", () => {
  describe("initRouting()", () => {
    beforeEach(() => {
      appMock = {
        get: jest.fn(),
        post: jest.fn(),
        put: jest.fn(),
        delete: jest.fn(),
        patch: jest.fn(),
        options: jest.fn(),
        use: jest.fn(),
      };

      loggerMock = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };
    });

    test("Should set right methods", () => {
      const handlerMock = jest.fn();
      const configMock = {
        cors: true,
        startupLogo: false,
      };
      const factory = new EndpointsFactory(defaultResultHandler);
      const getEndpoint = factory.build({
        methods: ["get"],
        input: z.object({}),
        output: z.object({}),
        handler: handlerMock,
      });
      const postEndpoint = factory.build({
        methods: ["post"],
        input: z.object({}),
        output: z.object({}),
        handler: handlerMock,
      });
      const getAndPostEndpoint = factory.build({
        methods: ["get", "post"],
        input: z.object({}),
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
      initRouting({
        app: appMock as Express,
        logger: loggerMock as Logger,
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
    });

    test("Should accept serveStatic", () => {
      const routing: Routing = {
        public: new ServeStatic(__dirname, { dotfiles: "deny" }),
      };
      const configMock = {
        cors: true,
        startupLogo: false,
      };
      initRouting({
        app: appMock,
        logger: loggerMock,
        config: configMock as CommonConfig,
        routing,
      });
      expect(staticMock).toHaveBeenCalledWith(__dirname, { dotfiles: "deny" });
      expect(appMock.use).toHaveBeenCalledTimes(1);
      expect(appMock.use).toHaveBeenCalledWith("/public", staticHandler);
    });

    test("Should accept DependsOnMethod", () => {
      const handlerMock = jest.fn();
      const configMock = {
        cors: true,
        startupLogo: false,
      };
      const factory = new EndpointsFactory(defaultResultHandler);
      const getEndpoint = factory.build({
        methods: ["get"],
        input: z.object({}),
        output: z.object({}),
        handler: handlerMock,
      });
      const postEndpoint = factory.build({
        methods: ["post"],
        input: z.object({}),
        output: z.object({}),
        handler: handlerMock,
      });
      const putAndPatchEndpoint = factory.build({
        methods: ["put", "patch"],
        input: z.object({}),
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
      initRouting({
        app: appMock as Express,
        logger: loggerMock as Logger,
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
        methods: ["put", "patch"],
        input: z.object({}),
        output: z.object({}),
        handler: jest.fn(),
      });
      const routing: Routing = {
        v1: {
          user: new DependsOnMethod({
            put: putAndPatchEndpoint,
            patch: putAndPatchEndpoint,
            post: putAndPatchEndpoint as any, // intentional
          }),
        },
      };
      expect(() =>
        initRouting({
          app: appMock as Express,
          logger: loggerMock as Logger,
          config: configMock as CommonConfig,
          routing,
        }),
      ).toThrowErrorMatchingSnapshot();
    });

    test("Issue 705: should set all DependsOnMethod' methods for CORS", async () => {
      const handler = jest.fn(async () => ({}));
      const configMock = {
        cors: true,
        startupLogo: false,
      };
      const factory = new EndpointsFactory(defaultResultHandler);
      const input = z.object({});
      const output = z.object({});
      const getEndpoint = factory.build({
        method: "get",
        input,
        output,
        handler,
      });
      const postEndpoint = factory.build({
        method: "post",
        input,
        output,
        handler,
      });
      const putAndPatchEndpoint = factory.build({
        methods: ["put", "patch"],
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
      initRouting({
        app: appMock as Express,
        logger: loggerMock as Logger,
        config: configMock as CommonConfig,
        routing,
      });
      expect(appMock.options).toHaveBeenCalledTimes(1);
      expect(appMock.options.mock.calls[0][0]).toBe("/hello");
      const fn = appMock.options.mock.calls[0][1];
      expect(typeof fn).toBe("function"); // async (req, res) => void
      const requestMock = makeRequestMock({
        fnMethod: jest.fn,
        requestProps: { method: "PUT" },
      });
      const responseMock = makeResponseMock({ fnMethod: jest.fn });
      await fn(requestMock, responseMock);
      expect(responseMock.status).toHaveBeenCalledWith(200);
      expect(responseMock.set).toHaveBeenCalledTimes(3);
      expect(responseMock.set).toHaveBeenCalledWith(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, PATCH, OPTIONS",
      );
    });

    test("Should accept parameters", () => {
      const handlerMock = jest.fn();
      const configMock = { startupLogo: false };
      const endpointMock = new EndpointsFactory(defaultResultHandler).build({
        methods: ["get"],
        input: z.object({}),
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
      initRouting({
        app: appMock as Express,
        logger: loggerMock as Logger,
        config: configMock as CommonConfig,
        routing,
      });
      expect(appMock.get).toHaveBeenCalledTimes(1);
      expect(appMock.get.mock.calls[0][0]).toBe("/v1/user/:id");
    });

    test("Should handle empty paths and trim spaces", () => {
      const handlerMock = jest.fn();
      const configMock = { startupLogo: false };
      const endpointMock = new EndpointsFactory(defaultResultHandler).build({
        methods: ["get"],
        input: z.object({}),
        output: z.object({}),
        handler: handlerMock,
      });
      const routing: Routing = {
        v1: {
          user: {
            ":id": {
              "": endpointMock,
              " download ": endpointMock,
            },
          },
        },
      };
      initRouting({
        app: appMock as Express,
        logger: loggerMock as Logger,
        config: configMock as CommonConfig,
        routing,
      });
      expect(appMock.get).toHaveBeenCalledTimes(2);
      expect(appMock.get.mock.calls[0][0]).toBe("/v1/user/:id");
      expect(appMock.get.mock.calls[1][0]).toBe("/v1/user/:id/download");
    });

    test("Should throw an error in case of slashes in route", () => {
      const handlerMock = jest.fn();
      const configMock = { startupLogo: false };
      const endpointMock = new EndpointsFactory(defaultResultHandler).build({
        methods: ["get"],
        input: z.object({}),
        output: z.object({}),
        handler: handlerMock,
      });
      expect(() =>
        initRouting({
          app: appMock as Express,
          logger: loggerMock as Logger,
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
          app: appMock as Express,
          logger: loggerMock as Logger,
          config: configMock as CommonConfig,
          routing: {
            "v1/user/retrieve": endpointMock,
          },
        }),
      ).toThrowErrorMatchingSnapshot();
    });

    test("Should execute endpoints with right arguments", async () => {
      const handlerMock = jest
        .fn()
        .mockImplementationOnce(() => ({ result: true }));
      const configMock = { cors: true, startupLogo: false };
      const setEndpoint = new EndpointsFactory(defaultResultHandler).build({
        methods: ["post"],
        input: z.object({
          test: z.number(),
        }),
        output: z.object({
          result: z.boolean(),
        }),
        handler: handlerMock,
      });
      const routing: Routing = {
        v1: {
          user: {
            set: setEndpoint,
          },
        },
      };
      initRouting({
        app: appMock as Express,
        logger: loggerMock as Logger,
        config: configMock as CommonConfig,
        routing,
      });
      expect(appMock.post).toHaveBeenCalledTimes(1);
      const routeHandler = appMock.post.mock.calls[0][1] as RequestHandler;
      const requestMock = {
        method: "POST",
        header: jest.fn(() => mimeJson),
        body: {
          test: 123,
        },
      };
      const responseMock: Record<string, jest.Mock> = {
        set: jest.fn().mockImplementation(() => responseMock),
        status: jest.fn().mockImplementation(() => responseMock),
        json: jest.fn().mockImplementation(() => responseMock),
      };
      const nextMock = jest.fn();
      await routeHandler(
        requestMock as unknown as Request,
        responseMock as unknown as Response,
        nextMock,
      );
      expect(nextMock).toHaveBeenCalledTimes(0);
      expect(handlerMock).toHaveBeenCalledTimes(1);
      expect(loggerMock.info).toHaveBeenCalledWith("POST: /v1/user/set");
      expect(loggerMock.error).toHaveBeenCalledTimes(0);
      expect(handlerMock).toHaveBeenCalledWith({
        input: {
          test: 123,
        },
        options: {},
        logger: loggerMock,
      });
      expect(responseMock.status).toHaveBeenCalledWith(200);
      expect(responseMock.json).toHaveBeenCalledWith({
        status: "success",
        data: {
          result: true,
        },
      });
    });
  });
});
