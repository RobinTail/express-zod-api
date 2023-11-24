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
      const { responseMock } = await testEndpoint({
        endpoint,
        fnMethod: jest.fn,
      });
      expect(responseMock.setHeader).toHaveBeenCalledWith("X-Some", "header");
      expect(responseMock.header).toHaveBeenCalledWith(
        "X-Another",
        "header as well",
      );
      expect(responseMock.send).toHaveBeenCalledWith(
        "this is just for testing mocked methods",
      );
    });
  });
});
