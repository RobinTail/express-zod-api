import { performance } from "node:perf_hooks";
import * as util from "node:util";
import {
  blueMock,
  greenMock,
  customMock,
  redMock,
  cyanMock,
} from "./ansis-mock";
import * as R from "ramda";
import { BuiltinLogger, BuiltinLoggerConfig } from "../src/builtin-logger";

vi.mock("node:util", { spy: true });

describe("BuiltinLogger", () => {
  beforeEach(() => {
    vi.restoreAllMocks(); // vitest 3 .spyOn() reuses existing spy, see makeLogger()
    vi.useFakeTimers({ now: new Date("2022-01-01T00:00:00Z") });
    blueMock.mockClear();
    greenMock.mockClear();
    customMock.mockClear();
    redMock.mockClear();
    cyanMock.mockClear();
    vi.mocked(util.inspect).mockClear();
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
      expect(logSpy).toHaveBeenCalledWith(
        "2022-01-01T00:00:00.000Z warn: testing warn message { withMeta: true }",
      );
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
        vi.stubEnv("TSDOWN_STATIC", mode);
        vi.stubEnv("NODE_ENV", mode);
        const { logger } = makeLogger();
        expect(logger["config"]["level"]).toBe(
          mode === "production" ? "warn" : "debug",
        );
      },
    );
  });

  describe("print()", () => {
    test.each(
      R.toPairs({
        debug: blueMock,
        info: greenMock,
        warn: customMock,
        error: redMock,
      }),
    )("debug logger should display %s message", (method, styleMock) => {
      const { logger, logSpy } = makeLogger({ level: "debug", color: true });
      logger[method]("testing debug message", { withColorful: "output" });
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining("testing debug message"),
      );
      expect(styleMock).toHaveBeenCalledWith(method);
      expect(vi.mocked(util.inspect)).toHaveBeenCalledWith(
        { withColorful: "output" },
        { colors: true, depth: 2, breakLength: 80, compact: 3 },
      );
    });

    test.each(["debug", "warn"] as const)(
      "%s logger should display primitive metadata",
      (level) => {
        const { logger, logSpy } = makeLogger({ level, color: true });
        logger.error("Code", 1234);
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Code"));
        expect(redMock).toHaveBeenCalledWith("error");
        expect(vi.mocked(util.inspect)).toHaveBeenCalledWith(1234, {
          colors: true,
          depth: 2,
          breakLength: level === "debug" ? 80 : Infinity,
          compact: level === "debug" ? 3 : true,
        });
      },
    );

    test.each(["debug", "warn"] as const)(
      "%s logger should display object metadata",
      (level) => {
        const { logger, logSpy } = makeLogger({ level, color: true });
        logger.error("Payload", {});
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Payload"));
        expect(redMock).toHaveBeenCalledWith("error");
        expect(vi.mocked(util.inspect)).toHaveBeenCalledWith(
          {},
          {
            colors: true,
            depth: 2,
            breakLength: level === "debug" ? 80 : Infinity,
            compact: level === "debug" ? 3 : true,
          },
        );
      },
    );

    test.each(["debug", "warn"] as const)(
      "%s logger should display array metadata",
      (level) => {
        const { logger, logSpy } = makeLogger({ level, color: true });
        logger.error("Array", ["test"]);
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Array"));
        expect(redMock).toHaveBeenCalledWith("error");
        expect(vi.mocked(util.inspect)).toHaveBeenCalledWith(["test"], {
          colors: true,
          depth: 2,
          breakLength: level === "debug" ? 80 : Infinity,
          compact: level === "debug" ? 3 : true,
        });
      },
    );

    test("should display error metadata including its cause", () => {
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
      "%s logger should handle circular references",
      (level) => {
        const { logger, logSpy } = makeLogger({ level, color: false });
        const subject: any = {};
        subject.a = [subject];
        subject.b = {};
        subject.b.inner = subject.b;
        subject.b.obj = subject;
        logger.error("Recursive", subject);
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining("Circular"),
        );
      },
    );
  });

  describe.each([true, false])(".child() when color=%s", (color) => {
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
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining("Here is some message"),
      );
      if (color) expect(greenMock).toHaveBeenCalledWith("info");
      else expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("info"));
      expect(vi.mocked(util.inspect)).toHaveBeenCalledWith(
        { more: "information" },
        { colors: color, depth: 2, breakLength: Infinity, compact: true },
      );
      if (color) {
        expect(cyanMock).toHaveBeenCalledWith(ctx.requestId);
      } else {
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining(ctx.requestId),
        );
      }
      const { extra } = ctx;
      if (extra) {
        expect(vi.mocked(util.inspect)).toHaveBeenCalledWith(
          { extra },
          { colors: color, depth: 2, breakLength: Infinity, compact: true },
        );
      }
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
