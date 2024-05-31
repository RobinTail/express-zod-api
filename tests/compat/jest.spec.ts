import { defaultEndpointsFactory, testEndpoint } from "express-zod-api";
import { z } from "zod";

declare module "express-zod-api" {
  interface MockOverrides extends jest.Mock {}
}

describe("Jest compatibility test", () => {
  describe("testEndpoint()", () => {
    test.each([undefined, jest.fn])(
      "should support jest.fn %#",
      async (fnMethod) => {
        const endpoint = defaultEndpointsFactory.build({
          method: "post",
          input: z.object({ n: z.number() }),
          output: z.object({ inc: z.number() }),
          handler: async ({ input }) => ({ inc: input.n + 1 }),
        });
        const { responseMock } = await testEndpoint({
          endpoint,
          requestProps: { method: "POST", body: { n: 123 } },
          fnMethod,
        });
        expect(responseMock._getStatusCode()).toBe(200);
        expect(responseMock._getData()).toBe(
          JSON.stringify({
            status: "success",
            data: { inc: 124 },
          }),
        );
      },
    );
  });
});
