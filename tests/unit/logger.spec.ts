import { LEVEL, MESSAGE, SPLAT } from "triple-beam";
import MockDate from "mockdate";
import stripAnsi from "strip-ansi";
import hasAnsi from "has-ansi";
import { createLogger, isSimplifiedWinstonConfig } from "../../src/logger";
import winston from "winston";

describe("Logger", () => {
  beforeEach(() => {
    MockDate.set("2022-01-01T00:00:00Z");
  });

  afterAll(() => {
    MockDate.reset();
  });

  const dropColorInObjectProps = <T extends Record<string | symbol, any>>(
    obj: T,
  ) => {
    return Reflect.ownKeys(obj).reduce(
      (acc, key) => ({
        ...acc,
        [key]: typeof obj[key] === "string" ? stripAnsi(obj[key]) : obj[key],
      }),
      {} as typeof obj,
    );
  };

  describe("createWinstonLogger()", () => {
    test("Should create silent logger", () => {
      const logger = createLogger({ winston, level: "silent" });
      const transform = jest.spyOn(logger.transports[0].format!, "transform");
      expect(logger.silent).toBeTruthy();
      expect(logger.isErrorEnabled()).toBeTruthy();
      expect(logger.isWarnEnabled()).toBeTruthy();
      expect(logger.isInfoEnabled()).toBeFalsy();
      expect(logger.isVerboseEnabled()).toBeFalsy();
      expect(logger.isDebugEnabled()).toBeFalsy();
      expect(logger.isSillyEnabled()).toBeFalsy();
      logger.error("test");
      expect(transform).toHaveBeenCalledTimes(0);
    });

    test("Should create warn logger", () => {
      const logger = createLogger({ winston, level: "warn" });
      const transform = jest.spyOn(logger.transports[0].format!, "transform");
      expect(logger.isErrorEnabled()).toBeTruthy();
      expect(logger.isWarnEnabled()).toBeTruthy();
      expect(logger.isInfoEnabled()).toBeFalsy();
      expect(logger.isVerboseEnabled()).toBeFalsy();
      expect(logger.isDebugEnabled()).toBeFalsy();
      expect(logger.isSillyEnabled()).toBeFalsy();
      logger.warn("testing warn message", { withMeta: true });
      expect(transform).toHaveBeenCalled();
      const params = transform.mock.calls[0][0];
      expect(params).toEqual({
        level: "warn",
        [LEVEL]: "warn",
        timestamp: "2022-01-01T00:00:00.000Z",
        [SPLAT]: [{ withMeta: true }],
        withMeta: true,
        message: "testing warn message",
        [MESSAGE]:
          '2022-01-01T00:00:00.000Z warn: testing warn message {"withMeta":true}',
      });
      expect(hasAnsi(params.level)).toBeFalsy();
    });

    test("Should create debug logger", () => {
      const logger = createLogger({ winston, level: "debug", color: true });
      const transform = jest.spyOn(logger.transports[0].format!, "transform");
      expect(logger.isErrorEnabled()).toBeTruthy();
      expect(logger.isWarnEnabled()).toBeTruthy();
      expect(logger.isInfoEnabled()).toBeTruthy();
      expect(logger.isVerboseEnabled()).toBeTruthy();
      expect(logger.isDebugEnabled()).toBeTruthy();
      expect(logger.isSillyEnabled()).toBeFalsy();
      logger.debug("testing debug message", { withColorful: "output" });
      expect(transform).toHaveBeenCalled();
      const params = transform.mock.calls[0][0];
      expect(dropColorInObjectProps(params)).toEqual({
        level: "debug",
        [LEVEL]: "debug",
        timestamp: "2022-01-01T00:00:00.000Z",
        [SPLAT]: [{ withColorful: "output" }],
        withColorful: "output",
        message: "testing debug message",
        [MESSAGE]: `2022-01-01T00:00:00.000Z debug: testing debug message { withColorful: 'output' }`,
      });
      expect(hasAnsi(params.level)).toBeTruthy();
    });

    test("Should manage profiling", () => {
      const logger = createLogger({ winston, level: "debug", color: true });
      const transform = jest.spyOn(logger.transports[0].format!, "transform");
      logger.profile("long-test");
      MockDate.set("2022-01-01T00:00:00.554Z");
      logger.profile("long-test");
      expect(transform).toHaveBeenCalled();
      const params = transform.mock.calls[0][0];
      expect(dropColorInObjectProps(params)).toEqual({
        durationMs: 554,
        level: "info",
        [LEVEL]: "info",
        timestamp: "2022-01-01T00:00:00.554Z",
        message: "long-test",
        [MESSAGE]: `2022-01-01T00:00:00.554Z info: long-test duration: 554ms`,
      });
      expect(hasAnsi(params.level)).toBeTruthy();
    });

    test("Should handle empty message", () => {
      const logger = createLogger({ winston, level: "debug", color: true });
      const transform = jest.spyOn(logger.transports[0].format!, "transform");
      expect(logger.isErrorEnabled()).toBeTruthy();
      expect(logger.isWarnEnabled()).toBeTruthy();
      expect(logger.isInfoEnabled()).toBeTruthy();
      expect(logger.isVerboseEnabled()).toBeTruthy();
      expect(logger.isDebugEnabled()).toBeTruthy();
      expect(logger.isSillyEnabled()).toBeFalsy();
      logger.error({ someData: "test" });
      expect(transform).toHaveBeenCalled();
      const params = transform.mock.calls[0][0];
      expect(dropColorInObjectProps(params)).toEqual({
        level: "error",
        [LEVEL]: "error",
        timestamp: "2022-01-01T00:00:00.000Z",
        message: { someData: "test" },
        [MESSAGE]: `2022-01-01T00:00:00.000Z error: [No message] { someData: 'test' }`,
      });
      expect(hasAnsi(params.level)).toBeTruthy();
    });

    test.each(["debug", "warn"] as const)(
      "Should handle non-object meta %#",
      (level) => {
        const logger = createLogger({ winston, level, color: true });
        const transform = jest.spyOn(logger.transports[0].format!, "transform");
        logger.error("Code", 8090);
        expect(transform).toHaveBeenCalled();
        const params = transform.mock.calls[0][0];
        expect(dropColorInObjectProps(params)).toEqual({
          level: "error",
          [LEVEL]: "error",
          timestamp: "2022-01-01T00:00:00.000Z",
          [SPLAT]: [8090],
          message: "Code",
          [MESSAGE]: `2022-01-01T00:00:00.000Z error: Code 8090`,
        });
      },
    );

    test.each(["debug", "warn"] as const)(
      "Should handle empty object meta",
      (level) => {
        const logger = createLogger({ winston, level, color: true });
        const transform = jest.spyOn(logger.transports[0].format!, "transform");
        logger.error("Payload", {});
        expect(transform).toHaveBeenCalled();
        const params = transform.mock.calls[0][0];
        expect(dropColorInObjectProps(params)).toEqual({
          level: "error",
          [LEVEL]: "error",
          timestamp: "2022-01-01T00:00:00.000Z",
          [SPLAT]: [{}],
          message: "Payload",
          [MESSAGE]: `2022-01-01T00:00:00.000Z error: Payload {}`,
        });
      },
    );
  });

  describe("isSimplifiedLoggerConfig()", () => {
    test.each([
      { level: "silent" },
      { level: "debug", color: false },
      { level: "warn", color: true },
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
    ])("should invalidate config %#", (sample) => {
      expect(isSimplifiedWinstonConfig(sample)).toBeFalsy();
    });
  });
});
