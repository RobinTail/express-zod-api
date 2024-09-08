import { z } from "zod";
import { InputValidationError, Middleware } from "../../src";
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
          logger: makeLoggerMock(),
          request: makeRequestMock(),
          response: makeResponseMock(),
        }),
      ).rejects.toThrow(InputValidationError);
    });

    test("should call the handler and return its output", async () => {
      const handlerMock = vi.fn<any>(() => ({ result: "test" }));
      const mw = new Middleware({
        input: z.object({ test: z.string() }),
        handler: handlerMock,
      });
      const loggerMock = makeLoggerMock();
      const requestMock = makeRequestMock();
      const responseMock = makeResponseMock();
      expect(
        await mw.execute({
          input: { test: "something" },
          options: { opt: "anything " },
          logger: loggerMock,
          request: requestMock,
          response: responseMock,
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
