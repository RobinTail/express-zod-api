import MockDate from "mockdate";
import { EventEmitter } from "node:events";
import { LoggerConfig, createLogger, isLoggerConfig } from "../../src/logger";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

describe("Logger", () => {
  beforeAll(() => {
    // fix (node:58829) MaxListenersExceededWarning: Possible EventEmitter memory leak
    EventEmitter.setMaxListeners(15);
  });

  beforeEach(() => {
    MockDate.set("2022-01-01T00:00:00Z");
  });

  afterAll(() => {
    MockDate.reset();
  });

  const makeLogger = (props: LoggerConfig) => {
    const logger = createLogger({ ...props });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    return { logger, logSpy };
  };

  describe("createWinstonLogger()", () => {
    test("Should create silent logger", () => {
      const { logger, logSpy } = makeLogger({ level: "silent" });
      logger.error("test");
      expect(logSpy).toHaveBeenCalledTimes(0);
    });

    test("Should create warn logger", () => {
      const { logger, logSpy } = makeLogger({ level: "warn" });
      logger.warn("testing warn message", { withMeta: true });
      expect(logSpy.mock.calls).toMatchSnapshot();
    });

    test("Should create debug logger", () => {
      const { logger, logSpy } = makeLogger({ level: "debug", color: true });
      logger.debug("testing debug message", { withColorful: "output" });
      expect(logSpy.mock.calls).toMatchSnapshot();
    });

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

  describe("isLoggerConfig()", () => {
    test.each([
      { level: "silent" },
      { level: "debug", color: false },
      { level: "warn", color: true },
      { level: "warn", depth: 5 },
      { level: "warn", depth: null },
      { level: "warn", depth: Infinity },
    ])("should validate config %#", (sample) => {
      expect(isLoggerConfig(sample)).toBeTruthy();
    });

    test.each([
      null,
      undefined,
      {},
      { level: null },
      { level: "wrong" },
      { level: "debug", color: null },
      { level: "debug", depth: "wrong" },
      // issue #1605: should not allow methods
      { level: "debug", debug: () => {} },
      { level: "warn", error: () => {} },
    ])("should invalidate config %#", (sample) => {
      expect(isLoggerConfig(sample)).toBeFalsy();
    });
  });
});
