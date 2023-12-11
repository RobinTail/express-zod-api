import { expectType } from "tsd";
import { z } from "zod";
import {
  createMiddleware,
  defaultEndpointsFactory,
  testEndpoint,
} from "../../src";
import { Mock, describe, expect, test, vi } from "vitest";

declare module "../../src" {
  interface MockOverrides extends Mock {}
}

describe("Testing", () => {
  describe("testEndpoint()", () => {
    test.each([undefined, vi.fn])(
      "Should test the endpoint %#",
      async (fnMethod) => {
        const endpoint = defaultEndpointsFactory
          .addMiddleware(
            createMiddleware({
              input: z.object({}),
              middleware: async ({ response }) => {
                response
                  .setHeader("X-Some", "header")
                  .header("X-Another", "header as well")
                  .send("this is just for testing mocked methods");
                return {};
              },
            }),
          )
          .build({
            method: "get",
            input: z.object({}),
            output: z.object({}),
            handler: async () => ({}),
          });
        const { responseMock, requestMock, loggerMock } = await testEndpoint({
          endpoint,
          responseProps: { prop1: vi.fn(), prop2: 123 },
          requestProps: { test1: vi.fn(), test2: 456 },
          loggerProps: { feat1: vi.fn(), feat2: 789 },
          fnMethod,
        });
        expect(responseMock.setHeader).toHaveBeenCalledWith("X-Some", "header");
        expect(responseMock.header).toHaveBeenCalledWith(
          "X-Another",
          "header as well",
        );
        expect(responseMock.send).toHaveBeenCalledWith(
          "this is just for testing mocked methods",
        );
        expect(responseMock.prop1).toEqual(expect.any(Function));
        expect(responseMock.prop2).toBe(123);
        expect(requestMock.test1).toEqual(expect.any(Function));
        expect(requestMock.test2).toBe(456);
        expect(loggerMock.feat1).toEqual(expect.any(Function));
        expect(loggerMock.feat2).toBe(789);
        expectType<Mock>(responseMock.prop1);
        expectType<Mock>(requestMock.test1);
        expectType<Mock>(loggerMock.feat1);
      },
    );
  });
});
