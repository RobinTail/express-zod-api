import { createLogger, LoggerConfig } from "../../src";
import { LEVEL, MESSAGE, SPLAT } from "triple-beam";
import MockDate from "mockdate";
import chalk from "chalk";

describe("Logger", () => {
  beforeEach(() => {
    MockDate.set("2022-01-01T00:00:00Z");
  });

  afterAll(() => {
    MockDate.reset();
  });

  describe("createLogger()", () => {
    test("Should create silent logger", () => {
      const loggerConfig: LoggerConfig = {
        level: "silent",
        color: false,
      };
      const logger = createLogger(loggerConfig);
      const transform = jest.spyOn(logger.transports[0].format!, "transform");
      expect(logger.silent).toBeTruthy();
      expect(logger.isErrorEnabled()).toBeTruthy();
      expect(logger.isWarnEnabled()).toBeTruthy();
      expect(logger.isInfoEnabled()).toBeFalsy();
      expect(logger.isVerboseEnabled()).toBeFalsy();
      expect(logger.isDebugEnabled()).toBeFalsy();
      expect(logger.isSillyEnabled()).toBeFalsy();
      logger.error("test");
      expect(transform).toBeCalledTimes(0);
    });

    test("Should create warn logger", () => {
      const loggerConfig: LoggerConfig = {
        level: "warn",
        color: false,
      };
      const logger = createLogger(loggerConfig);
      const transform = jest.spyOn(logger.transports[0].format!, "transform");
      expect(logger.isErrorEnabled()).toBeTruthy();
      expect(logger.isWarnEnabled()).toBeTruthy();
      expect(logger.isInfoEnabled()).toBeFalsy();
      expect(logger.isVerboseEnabled()).toBeFalsy();
      expect(logger.isDebugEnabled()).toBeFalsy();
      expect(logger.isSillyEnabled()).toBeFalsy();
      logger.warn("testing warn message", { withMeta: true });
      expect(transform).toBeCalled();
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
    });

    test("Should create debug logger", () => {
      const loggerConfig: LoggerConfig = {
        level: "debug",
        color: true,
      };
      const logger = createLogger(loggerConfig);
      const transform = jest.spyOn(logger.transports[0].format!, "transform");
      expect(logger.isErrorEnabled()).toBeTruthy();
      expect(logger.isWarnEnabled()).toBeTruthy();
      expect(logger.isInfoEnabled()).toBeTruthy();
      expect(logger.isVerboseEnabled()).toBeTruthy();
      expect(logger.isDebugEnabled()).toBeTruthy();
      expect(logger.isSillyEnabled()).toBeFalsy();
      logger.debug("testing debug message", { withColorful: "output" });
      expect(transform).toBeCalled();
      const params = transform.mock.calls[0][0];
      expect(params).toEqual({
        level: chalk.blue("debug"),
        [LEVEL]: "debug",
        timestamp: "2022-01-01T00:00:00.000Z",
        [SPLAT]: [{ withColorful: "output" }],
        withColorful: "output",
        message: "testing debug message",
        [MESSAGE]: `2022-01-01T00:00:00.000Z ${chalk.blue(
          "debug"
        )}: testing debug message { withColorful: ${chalk.green("'output'")} }`,
      });
    });

    test("Should manage profiling", () => {
      const loggerConfig: LoggerConfig = {
        level: "debug",
        color: true,
      };
      const logger = createLogger(loggerConfig);
      const transform = jest.spyOn(logger.transports[0].format!, "transform");
      logger.profile("long-test");
      MockDate.set("2022-01-01T00:00:00.554Z");
      logger.profile("long-test");
      expect(transform).toBeCalled();
      const params = transform.mock.calls[0][0];
      expect(params).toEqual({
        durationMs: 554,
        level: chalk.green("info"),
        [LEVEL]: "info",
        timestamp: "2022-01-01T00:00:00.554Z",
        message: "long-test",
        [MESSAGE]: `2022-01-01T00:00:00.554Z ${chalk.green(
          "info"
        )}: long-test duration: 554ms`,
      });
    });

    test("Should handle empty message", () => {
      const loggerConfig: LoggerConfig = {
        level: "debug",
        color: true,
      };
      const logger = createLogger(loggerConfig);
      const transform = jest.spyOn(logger.transports[0].format!, "transform");
      expect(logger.isErrorEnabled()).toBeTruthy();
      expect(logger.isWarnEnabled()).toBeTruthy();
      expect(logger.isInfoEnabled()).toBeTruthy();
      expect(logger.isVerboseEnabled()).toBeTruthy();
      expect(logger.isDebugEnabled()).toBeTruthy();
      expect(logger.isSillyEnabled()).toBeFalsy();
      logger.error({ someData: "test" });
      expect(transform).toBeCalled();
      const params = transform.mock.calls[0][0];
      expect(params).toEqual({
        level: chalk.red("error"),
        [LEVEL]: "error",
        timestamp: "2022-01-01T00:00:00.000Z",
        message: { someData: "test" },
        [MESSAGE]: `2022-01-01T00:00:00.000Z ${chalk.red(
          "error"
        )}: [No message] { someData: ${chalk.green("'test'")} }`,
      });
    });
  });
});
