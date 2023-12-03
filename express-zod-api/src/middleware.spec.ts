import { z } from "zod";
import { createMiddleware } from "./index";
import { IOSchemaError } from "./errors";

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

    describe("#600: Top level refinements", () => {
      test("should allow refinement", () => {
        const definition = {
          input: z
            .object({
              something: z.number(),
            })
            .refine(() => true),
          middleware: jest.fn(),
        };
        const middleware = createMiddleware(definition);
        expect(middleware).toStrictEqual({
          ...definition,
          type: "proprietary",
        });
      });

      test("should throw on transformations", () => {
        const definition = {
          input: z
            .object({
              something: z.number(),
            })
            .transform(() => []),
          middleware: jest.fn(),
        };
        expect(() => createMiddleware(definition)).toThrow(
          new IOSchemaError(
            "Using transformations on the top level of middleware input schema is not allowed.",
          ),
        );
      });
    });
  });
});
