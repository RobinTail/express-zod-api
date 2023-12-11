import { z } from "zod";
import { createMiddleware } from "../../src";
import { IOSchemaError } from "../../src/errors";
import { describe, expect, test, vi } from "vitest";

describe("Middleware", () => {
  describe("createMiddleware()", () => {
    test("Should simply return the middleware of the proprietary type", () => {
      const definition = {
        input: z.object({
          something: z.number(),
        }),
        middleware: vi.fn(),
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
          middleware: vi.fn(),
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
          middleware: vi.fn(),
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
