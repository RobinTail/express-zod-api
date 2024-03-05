import MockDate from "mockdate";
import { EventEmitter } from "node:events";
import pino from "pino";
import {
  SimplifiedWinstonConfig,
  createLogger,
  isSimplifiedWinstonConfig,
} from "../../src/logger";
import winston from "winston";
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

  const makeLogger = (props: SimplifiedWinstonConfig) => {
    const logger = createLogger({ winston, ...props });
    const logSpy = vi
      .spyOn(logger.transports[0], "log")
      .mockImplementation(({}, next) => next());
    return { logger, logSpy };
  };

  describe("createWinstonLogger()", () => {
    test("Should create silent logger", () => {
      const { logger, logSpy } = makeLogger({ level: "silent" });
      expect(logger.silent).toBeTruthy();
      expect(logger.isErrorEnabled()).toBeTruthy();
      expect(logger.isWarnEnabled()).toBeTruthy();
      expect(logger.isInfoEnabled()).toBeFalsy();
      expect(logger.isVerboseEnabled()).toBeFalsy();
      expect(logger.isDebugEnabled()).toBeFalsy();
      expect(logger.isSillyEnabled()).toBeFalsy();
      logger.error("test");
      expect(logSpy).toHaveBeenCalledTimes(0);
    });

    test("Should create warn logger", () => {
      const { logger, logSpy } = makeLogger({ level: "warn" });
      expect(logger.isErrorEnabled()).toBeTruthy();
      expect(logger.isWarnEnabled()).toBeTruthy();
      expect(logger.isInfoEnabled()).toBeFalsy();
      expect(logger.isVerboseEnabled()).toBeFalsy();
      expect(logger.isDebugEnabled()).toBeFalsy();
      expect(logger.isSillyEnabled()).toBeFalsy();
      logger.warn("testing warn message", { withMeta: true });
      expect(logSpy.mock.calls).toMatchSnapshot();
    });

    test("Should create debug logger", () => {
      const { logger, logSpy } = makeLogger({ level: "debug", color: true });
      expect(logger.isErrorEnabled()).toBeTruthy();
      expect(logger.isWarnEnabled()).toBeTruthy();
      expect(logger.isInfoEnabled()).toBeTruthy();
      expect(logger.isVerboseEnabled()).toBeTruthy();
      expect(logger.isDebugEnabled()).toBeTruthy();
      expect(logger.isSillyEnabled()).toBeFalsy();
      logger.debug("testing debug message", { withColorful: "output" });
      expect(logSpy.mock.calls).toMatchSnapshot();
    });

    test("Should manage profiling", () => {
      const { logger, logSpy } = makeLogger({ level: "debug", color: true });
      logger.profile("long-test");
      MockDate.set("2022-01-01T00:00:00.554Z");
      logger.profile("long-test");
      expect(logSpy.mock.calls).toMatchSnapshot();
    });

    test("Should handle empty message", () => {
      const { logger, logSpy } = makeLogger({ level: "debug", color: true });
      expect(logger.isErrorEnabled()).toBeTruthy();
      expect(logger.isWarnEnabled()).toBeTruthy();
      expect(logger.isInfoEnabled()).toBeTruthy();
      expect(logger.isVerboseEnabled()).toBeTruthy();
      expect(logger.isDebugEnabled()).toBeTruthy();
      expect(logger.isSillyEnabled()).toBeFalsy();
      logger.error({ someData: "test" });
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

    test("Should handle excessive arguments", () => {
      const { logger, logSpy } = makeLogger({ level: "debug", color: false });
      logger.debug("Test", { some: "value" }, [123], 456);
      expect(logSpy.mock.calls).toMatchSnapshot();
    });
  });

  describe("isSimplifiedWinstonConfig()", () => {
    test.each([
      { level: "silent" },
      { level: "debug", color: false },
      { level: "warn", color: true },
      { level: "warn", depth: 5 },
      { level: "warn", depth: null },
      { level: "warn", depth: Infinity },
    ])("should validate config %#", (sample) => {
      expect(isSimplifiedWinstonConfig(sample)).toBeTruthy();
    });

    test.each([
      null,
      undefined,
      {},
      { level: null },
      { level: "wrong" },
      { level: "debug", color: null },
      { level: "debug", depth: "wrong" },
    ])("should invalidate config %#", (sample) => {
      expect(isSimplifiedWinstonConfig(sample)).toBeFalsy();
    });

    test("Issue #1605: pino instance should be distingushable from the SimplifiedWinstonConfig", async () => {
      const subject = pino({ level: "info" });
      expect(isSimplifiedWinstonConfig(subject)).toBeFalsy();
    });
  });
});
