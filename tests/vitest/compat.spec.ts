import { defaultEndpointsFactory } from "../../src";
import { Mock, describe, expect, test } from "vitest";
import { z } from "zod";
import { testEndpoint } from "../../src";

declare module "../../src" {
  interface MockOverrides extends Mock {}
}

describe("Vitest compatibility test", () => {
  describe("testEndpoint()", () => {
    test("should support vi.fn", async () => {
      const endpoint = defaultEndpointsFactory.build({
        method: "post",
        input: z.object({ n: z.number() }),
        output: z.object({ inc: z.number() }),
        handler: async ({ input }) => ({ inc: input.n + 1 }),
      });
      const { responseMock } = await testEndpoint({
        endpoint,
        requestProps: { method: "POST", body: { n: 123 } },
      });
      expect(responseMock.status).toHaveBeenCalledWith(200);
      expect(responseMock.json).toHaveBeenCalledWith({
        status: "success",
        data: { inc: 124 },
      });
    });
  });
});
