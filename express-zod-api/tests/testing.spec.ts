import { z } from "zod/v4";
import {
  CommonConfig,
  defaultEndpointsFactory,
  Middleware,
  ResultHandler,
  testEndpoint,
  testMiddleware,
} from "../src";
import type { Mock } from "vitest";

describe("Testing", () => {
  describe("testEndpoint()", () => {
    test("Should test an endpoint", async () => {
      const endpoint = defaultEndpointsFactory
        .addMiddleware({
          handler: async ({ response }) => {
            response
              .setHeader("X-Some", "header")
              .header("X-Another", "header as well")
              .send("this is just for testing mocked methods");
            return {};
          },
        })
        .build({
          output: z.object({}),
          handler: async () => ({}),
        });
      const { responseMock, requestMock, loggerMock } = await testEndpoint({
        endpoint,
        responseOptions: { locals: { prop1: vi.fn(), prop2: 123 } },
        requestProps: { test1: vi.fn(), test2: 456 },
        loggerProps: { feat1: vi.fn(), feat2: 789 },
      });
      expect(responseMock._getHeaders()).toEqual({
        "x-some": "header",
        "x-another": "header as well",
      });
      expect(responseMock._getData()).toBe(
        "this is just for testing mocked methods",
      );
      expect(responseMock.locals).toHaveProperty("prop1", expect.any(Function));
      expect(responseMock.locals).toHaveProperty("prop2", 123);
      expect(requestMock.res?.locals).toHaveProperty(
        "prop1",
        expect.any(Function),
      );
      expect(requestMock.res?.locals).toHaveProperty("prop2", 123);
      expect(requestMock.test1).toEqual(expect.any(Function));
      expect(requestMock.test2).toBe(456);
      expect(responseMock.req).toHaveProperty("test1", expect.any(Function));
      expect(responseMock.req).toHaveProperty("test2", 456);
      expect(loggerMock.feat1).toEqual(expect.any(Function));
      expect(loggerMock.feat2).toBe(789);
      expectTypeOf(requestMock.test1).toEqualTypeOf<Mock>();
      expectTypeOf(loggerMock.feat1).toEqualTypeOf<Mock>();
    });
  });

  describe("testMiddleware()", () => {
    test("Should test a middleware", async () => {
      const { output } = await testMiddleware({
        requestProps: { method: "POST", body: { test: "something" } },
        options: { prev: "accumulated" },
        middleware: new Middleware({
          input: z.object({ test: z.string() }),
          handler: async ({ options, input: { test } }) => ({
            optKeys: Object.keys(options),
            inpLen: test.length,
          }),
        }),
      });
      expect(output).toEqual({
        optKeys: ["prev"],
        inpLen: 9,
      });
    });

    test.each<CommonConfig["errorHandler"]>([
      undefined,
      new ResultHandler({
        positive: [],
        negative: [],
        handler: ({ error, response }) => void response.end(error!.message),
      }),
    ])(
      "Issue #2153: should catch errors using errorHandler %#",
      async (errorHandler) => {
        const { output, loggerMock, responseMock } = await testMiddleware({
          configProps: { errorHandler },
          middleware: new Middleware({
            input: z.object({}),
            handler: async ({ logger }) => {
              logger.info("logging something");
              throw new Error("something went wrong");
            },
          }),
        });
        expect(output).toEqual({});
        expect(loggerMock._getLogs().info).toEqual([["logging something"]]);
        expect(responseMock._isJSON()).toBe(!errorHandler);
        if (responseMock._isJSON()) {
          expect(responseMock._getJSONData()).toEqual({
            status: "error",
            error: { message: "something went wrong" },
          });
        } else {
          expect(responseMock._getData()).toMatch(/something went wrong/);
        }
      },
    );
  });
});
