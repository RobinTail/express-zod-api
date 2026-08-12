import { z } from "zod";
import { InputValidationError, Middleware } from "../src";
import { AbstractMiddleware, ExpressMiddleware } from "../src/middleware";
import {
  makeLoggerMock,
  makeRequestMock,
  makeResponseMock,
} from "../src/testing";

describe("Middleware", () => {
  describe("constructor()", () => {
    test("should inherit from AbstractMiddleware", () => {
      const mw = new Middleware({
        input: z.object({ something: z.number() }),
        handler: vi.fn(),
      });
      expect(mw).toBeInstanceOf(AbstractMiddleware);
      expectTypeOf<z.output<typeof mw.schema>>().toEqualTypeOf<{
        something: number;
      }>();
    });

    test("should allow to omit input schema", () => {
      const mw = new Middleware({ handler: vi.fn() });
      expectTypeOf(mw.schema).toBeUndefined();
    });

    test.each<number | [number, ...number[]]>([429, [429, 503]])(
      "should expose the declared statusCodes %#",
      (statusCode) => {
        const mw = new Middleware({ statusCode, handler: vi.fn() });
        expect(mw.statusCodes).toEqual(
          new Set(typeof statusCode === "number" ? [statusCode] : statusCode),
        );
        expect(Object.isFrozen(mw.statusCodes)).toBe(true);
      },
    );

    test("should not mutate the supplied tuple when freezing the status codes", () => {
      const statusCode = [429, 503] as [number, ...number[]];
      const mw = new Middleware({ statusCode, handler: vi.fn() });
      expect(Object.isFrozen(statusCode)).toBe(false);
      statusCode.push(500);
      expect(mw.statusCodes).toEqual(new Set([429, 503]));
    });

    test("should allow to omit statusCode", () => {
      const mw = new Middleware({ handler: vi.fn() });
      expect(mw.statusCodes.size).toBe(0);
    });

    describe("#600: Top level refinements", () => {
      test("should allow refinement", () => {
        const mw = new Middleware({
          input: z.object({ something: z.number() }).refine(() => true),
          handler: vi.fn(),
        });
        expect(mw.schema).toBeInstanceOf(z.ZodObject);
      });
    });
  });

  describe(".execute()", () => {
    test("should validate the supplied input or throw an InputValidationError", async () => {
      const mw = new Middleware({
        input: z.object({ test: z.string() }),
        handler: vi.fn(),
      });
      await expect(() =>
        mw.execute({
          input: { test: 123 },
          ctx: {},
          logger: makeLoggerMock(),
          request: makeRequestMock(),
          response: makeResponseMock(),
        }),
      ).rejects.toThrow(InputValidationError);
    });

    test("should call the handler and return its output", async () => {
      const handlerMock = vi.fn(async () => ({ result: "test" }));
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
          ctx: { one: "anything " },
          logger: loggerMock,
          request: requestMock,
          response: responseMock,
        }),
      ).toEqual({ result: "test" });
      expect(handlerMock).toHaveBeenCalledWith({
        input: { test: "something" },
        ctx: { one: "anything " },
        logger: loggerMock,
        request: requestMock,
        response: responseMock,
      });
    });
  });
});

describe("ExpressMiddleware", () => {
  test("should inherit from Middleware", () => {
    const mw = new ExpressMiddleware(vi.fn());
    expect(mw).toBeInstanceOf(Middleware);
    expectTypeOf(mw.schema).toBeUndefined();
  });

  test("should expose the declared statusCodes", () => {
    const mw = new ExpressMiddleware(vi.fn(), { statusCode: 429 });
    expect(mw.statusCodes).toEqual(new Set([429]));
  });
});
