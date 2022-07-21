import { createMiddleware, z } from "../../src/index.js";

describe("Middleware", () => {
  describe("createMiddleware()", () => {
    test("Should simply return the middleware of the proprietary type", () => {
      const definition = {
        input: z.object({
          something: z.number(),
        }),
        middleware: jest.fn(),
      };
      const middleware = createMiddleware(definition);
      expect(middleware).toStrictEqual({ ...definition, type: "proprietary" });
    });
  });
});
