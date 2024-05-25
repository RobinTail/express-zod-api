import { z } from "zod";
import { Middleware } from "../../src";
import { IOSchemaError } from "../../src/errors";
import { describe, expect, test, vi } from "vitest";
import { AbstractMiddleware } from "../../src/middleware";

describe("Middleware", () => {
  describe("constructor()", () => {
    test("Should inherit from AbstractMiddleware", () => {
      const middleware = new Middleware({
        input: z.object({
          something: z.number(),
        }),
        handler: vi.fn<any>(),
      });
      expect(middleware).toBeInstanceOf(AbstractMiddleware);
    });

    describe("#600: Top level refinements", () => {
      test("should allow refinement", () => {
        const mw = new Middleware({
          input: z
            .object({
              something: z.number(),
            })
            .refine(() => true),
          handler: vi.fn<any>(),
        });
        expect(mw.getSchema()).toBeInstanceOf(z.ZodEffects);
      });

      test("should throw on transformations", () => {
        expect(
          () =>
            new Middleware({
              input: z
                .object({
                  something: z.number(),
                })
                .transform(() => []),
              handler: vi.fn<any>(),
            }),
        ).toThrow(
          new IOSchemaError(
            "Using transformations on the top level of middleware input schema is not allowed.",
          ),
        );
      });
    });
  });
});
