import { expectType } from "tsd";
import { z } from "zod";
import { defaultEndpointsFactory, testEndpoint } from "../../src";
import { Mock, describe, expect, test, vi } from "vitest";

describe("Testing", () => {
  describe("testEndpoint()", () => {
    test("Should test the endpoint", async () => {
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
      expect(requestMock.test1).toEqual(expect.any(Function));
      expect(requestMock.test2).toBe(456);
      expect(loggerMock.feat1).toEqual(expect.any(Function));
      expect(loggerMock.feat2).toBe(789);
      expectType<Mock>(requestMock.test1);
      expectType<Mock>(loggerMock.feat1);
    });
  });
});
