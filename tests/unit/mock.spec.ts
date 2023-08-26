import { z } from "zod";
import {
  createMiddleware,
  defaultEndpointsFactory,
  testEndpoint,
} from "../../src";

describe("Mock", () => {
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
      const { responseMock } = await testEndpoint({ endpoint });
      expect(responseMock.setHeader).toHaveBeenCalledWith("X-Some", "header");
      expect(responseMock.header).toHaveBeenCalledWith(
        "X-Another",
        "header as well",
      );
      expect(responseMock.send).toHaveBeenCalledWith(
        "this is just for testing mocked methods",
      );
    });

    test("Should throw an error in case Jest is not installed", async () => {
      const endpoint = defaultEndpointsFactory.build({
        method: "get",
        input: z.object({}),
        output: z.object({}),
        handler: async () => ({}),
      });
      try {
        await testEndpoint({ endpoint, __noJest: true });
        fail("Should not be here");
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        if (e instanceof Error) {
          expect(e.message).toBe(
            "You need to install Jest in order to use testEndpoint().",
          );
        }
      }
    });
  });
});
