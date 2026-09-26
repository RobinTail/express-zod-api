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
        const expected =
          typeof statusCode === "number" ? [statusCode] : statusCode;
        expect(Array.from(mw.statusCodes)).toEqual(expected);
        expect(() =>
          mw.statusCodes.delete(
            typeof statusCode === "number" ? statusCode : statusCode[0],
          ),
        ).toThrow(/read only/);
        expect(Array.from(mw.statusCodes)).toEqual(expected);
      },
    );

    test("should not mutate the supplied tuple when freezing the status codes", () => {
      const statusCode = [429, 503] as [number, ...number[]];
      const mw = new Middleware({ statusCode, handler: vi.fn() });
      expect(Object.isFrozen(statusCode)).toBe(false);
      statusCode.push(500);
      expect([...mw.statusCodes]).toEqual([429, 503]);
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
          config: { cors: false },
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
          config: { cors: false },
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

    test.each([{ trySyncValidation: true }, { trySyncValidation: false }])(
      "should handle async refinements with %s config",
      async (cfg) => {
        const refineMock = vi.fn(async () => true);
        const mw = new Middleware({
          input: z.object({ test: z.string().refine(refineMock) }),
          handler: vi.fn(async () => ({ result: "test" })),
        });
        const loggerMock = makeLoggerMock();
        const requestMock = makeRequestMock();
        const responseMock = makeResponseMock();
        const attempt = () =>
          mw.execute({
            input: { test: "something" },
            ctx: {},
            logger: loggerMock,
            request: requestMock,
            response: responseMock,
            config: { ...cfg, cors: false },
          });
        await expect(attempt()).resolves.toEqual({ result: "test" });
        expect(refineMock).toHaveBeenCalledTimes(cfg.trySyncValidation ? 2 : 1); // sync+async
        await attempt();
        expect(refineMock).toHaveBeenCalledTimes(cfg.trySyncValidation ? 3 : 2); // sync attempt skipped
      },
    );
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
    expect([...mw.statusCodes]).toEqual([429]);
  });
});
