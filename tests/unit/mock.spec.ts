import { defaultEndpointsFactory, z, testEndpoint } from "../../src/index.js";

describe("Mock", () => {
  describe("testEndpoint()", () => {
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
            "You need to install Jest in order to use testEndpoint()."
          );
        }
      }
    });
  });
});
