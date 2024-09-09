import { z } from "zod";
import { defaultEndpointsFactory, Middleware, testEndpoint } from "../../src";
import type { Mock } from "vitest";
import { testMiddleware } from "../../src/testing";

describe("Testing", () => {
  describe("testEndpoint()", () => {
    test("Should test an endpoint", async () => {
      const endpoint = defaultEndpointsFactory
        .addMiddleware({
          input: z.object({}),
          handler: async ({ response }) => {
            response
              .setHeader("X-Some", "header")
              .header("X-Another", "header as well")
              .send("this is just for testing mocked methods");
            return {};
          },
        })
        .build({
          method: "get",
          input: z.object({}),
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
  });
});
