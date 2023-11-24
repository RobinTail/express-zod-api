import { z } from "zod";
import {
  createMiddleware,
  defaultEndpointsFactory,
  testEndpoint,
} from "../../src";

describe("Testing", () => {
  describe("testEndpoint()", () => {
    test("Should test the endpoint", async () => {
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
        fnMethod: jest.fn,
        responseProps: { prop1: jest.fn(), prop2: 123 },
        requestProps: { test1: jest.fn(), test2: 456 },
        loggerProps: { feat1: jest.fn(), feat2: 789 },
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
    });
  });
});
