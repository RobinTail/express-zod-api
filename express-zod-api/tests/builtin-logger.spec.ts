import { performance } from "node:perf_hooks";
import { BuiltinLogger, BuiltinLoggerConfig } from "../src/builtin-logger.ts";

describe("BuiltinLogger", () => {
  beforeEach(() => {
    vi.restoreAllMocks(); // vitest 3 .spyOn() reuses existing spy, see makeLogger()
    vi.useFakeTimers({ now: new Date("2022-01-01T00:00:00Z") });
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  const makeLogger = (props?: Partial<BuiltinLoggerConfig>) => {
    const logger = new BuiltinLogger(props);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    return { logger, logSpy };
  };

  describe("constructor()", () => {
    afterEach(() => vi.unstubAllEnvs());

    test("Should create silent logger", () => {
      const { logger, logSpy } = makeLogger({ level: "silent" });
      logger.error("test");
      expect(logSpy).toHaveBeenCalledTimes(0);
    });

    test("Should create warn logger", () => {
      const { logger, logSpy } = makeLogger({ level: "warn", color: false });
      logger.warn("testing warn message", { withMeta: true });
      expect(logSpy.mock.calls).toMatchSnapshot();
    });

    test("Should create info logger", () => {
      const { logger, logSpy } = makeLogger({ level: "info", color: false });
      logger.debug("testing debug message");
      expect(logSpy).not.toHaveBeenCalled();
      logger.warn("testing warn message");
      expect(logSpy).toHaveBeenCalledTimes(1);
    });

    test.each(["development", "production"])(
      "Level can be omitted and depends on env",
      (mode) => {
        vi.stubEnv("TSUP_STATIC", mode);
        vi.stubEnv("NODE_ENV", mode);
        const { logger } = makeLogger();
        expect(logger["config"]["level"]).toBe(
          mode === "production" ? "warn" : "debug",
        );
      },
    );

    test.each(["debug", "info", "warn", "error"] as const)(
      "Should create debug logger %#",
      (method) => {
        const { logger, logSpy } = makeLogger({ level: "debug", color: true });
        logger[method]("testing debug message", { withColorful: "output" });
        expect(logSpy.mock.calls).toMatchSnapshot();
      },
    );

    test.each(["debug", "warn"] as const)(
      "Should handle non-object meta %#",
      (level) => {
        const { logger, logSpy } = makeLogger({ level, color: true });
        logger.error("Code", 8090);
        expect(logSpy.mock.calls).toMatchSnapshot();
      },
    );

    test.each(["debug", "warn"] as const)(
      "Should handle empty object meta %#",
      (level) => {
        const { logger, logSpy } = makeLogger({ level, color: true });
        logger.error("Payload", {});
        expect(logSpy.mock.calls).toMatchSnapshot();
      },
    );

    test.each(["debug", "warn"] as const)("Should handle array %#", (level) => {
      const { logger, logSpy } = makeLogger({ level, color: true });
      logger.error("Array", ["test"]);
      expect(logSpy.mock.calls).toMatchSnapshot();
    });

    test("should handle error including cause", () => {
      const error = new Error("something", { cause: new Error("anything") });
      const { logger, logSpy } = makeLogger({ level: "warn", color: false });
      logger.error("Failure", error);
      expect(logSpy).toHaveBeenCalledOnce();
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringMatching(
          /2022-01-01T00:00:00\.000Z error: Failure \{ Error: something/,
        ),
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[cause]: Error: anything/),
      );
    });

    test.each(["debug", "warn"] as const)(
      "Should handle circular references within subject %#",
      (level) => {
        const { logger, logSpy } = makeLogger({ level, color: false });
        const subject: any = {};
        subject.a = [subject];
        subject.b = {};
        subject.b.inner = subject.b;
        subject.b.obj = subject;
        logger.error("Recursive", subject);
        expect(logSpy.mock.calls).toMatchSnapshot();
      },
    );
  });

  describe.each([true, false])(".child()", (color) => {
    test.each([
      { requestId: "some id", extra: "data" },
      { requestId: "simple" },
    ])("should create a child logger %#", (ctx) => {
      const { logger: parent, logSpy } = makeLogger({
        level: "info",
        color,
      });
      const child = parent.child(ctx);
      expect(child.ctx).toEqual(ctx);
      child.info("Here is some message", { more: "information" });
      expect(logSpy.mock.calls).toMatchSnapshot();
    });
  });

  describe("profile()", () => {
    test.each([1e-3, 1e-2, 1e-1, 1, 1e1, 1e2, 1e3])(
      "should measure %s ms",
      async (delay) => {
        const { logger, logSpy } = makeLogger({ level: "debug", color: false });
        const stop = logger.profile("test");
        const start = performance.now();
        while (performance.now() - start < delay) {} // eslint-disable-line no-empty -- waits
        stop();
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringMatching(
            /2022-01-01T00:00:00.000Z debug: test '[\d.]+ (nano|micro|milli)?second(s)?'/,
          ),
        );
      },
    );

    test.each([
      undefined,
      "debug",
      "info",
      "warn",
      "error",
      () => "error",
    ] as const)("should accept severity option %s", (severity) => {
      const { logger, logSpy } = makeLogger({ level: "debug", color: false });
      logger.profile({ message: "test", severity })();
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `${typeof severity === "function" ? severity() : severity || "debug"}: test`,
        ),
      );
    });

    test.each([
      undefined,
      (ms: number) => Math.round(ms),
      (ms: number) => `${ms.toFixed(0)}ms`,
    ] as const)("should accept formatter option %#", (formatter) => {
      const { logger, logSpy } = makeLogger({ level: "debug", color: false });
      logger.profile({ message: "test", formatter })();
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringMatching(/debug: test '?\d+\s?\w*'?$/),
      );
    });
  });
});
