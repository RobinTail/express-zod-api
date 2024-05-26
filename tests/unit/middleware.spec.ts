import { z } from "zod";
import { Request, Response } from "express";
import { InputValidationError, Middleware } from "../../src";
import { IOSchemaError } from "../../src/errors";
import { describe, expect, test, vi } from "vitest";
import { AbstractMiddleware } from "../../src/middleware";
import {
  makeLoggerMock,
  makeRequestMock,
  makeResponseMock,
} from "../../src/testing";

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

  describe(".execute()", () => {
    test("should validate the supplied input or throw an InputValidationError", async () => {
      const mw = new Middleware({
        input: z.object({ test: z.string() }),
        handler: vi.fn<any>(),
      });
      await expect(() =>
        mw.execute({
          input: { test: 123 },
          options: {},
          logger: makeLoggerMock({ fnMethod: vi.fn }),
          request: makeRequestMock({ fnMethod: vi.fn }) as unknown as Request,
          response: makeResponseMock({
            fnMethod: vi.fn,
          }) as unknown as Response,
        }),
      ).rejects.toThrow(InputValidationError);
    });

    test("should call the handler and return its output", async () => {
      const handlerMock = vi.fn<any>(() => ({ result: "test" }));
      const mw = new Middleware({
        input: z.object({ test: z.string() }),
        handler: handlerMock,
      });
      const loggerMock = makeLoggerMock({ fnMethod: vi.fn });
      const requestMock = makeRequestMock({ fnMethod: vi.fn });
      const responseMock = makeResponseMock({ fnMethod: vi.fn });
      expect(
        await mw.execute({
          input: { test: "something" },
          options: { opt: "anything " },
          logger: loggerMock,
          request: requestMock as unknown as Request,
          response: responseMock as unknown as Response,
        }),
      ).toEqual({ result: "test" });
      expect(handlerMock).toHaveBeenCalledWith({
        input: { test: "something" },
        options: { opt: "anything " },
        logger: loggerMock,
        request: requestMock,
        response: responseMock,
      });
    });
  });
});
