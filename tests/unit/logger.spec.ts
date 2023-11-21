import { LEVEL, MESSAGE, SPLAT } from "triple-beam";
import MockDate from "mockdate";
import stripAnsi from "strip-ansi";
import hasAnsi from "has-ansi";
import { createWinstonLogger } from "../../src/logger";

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
    test("Should create silent logger", async () => {
      const logger = await createWinstonLogger({
        level: "silent",
        color: false,
      });
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

    test("Should create warn logger", async () => {
      const logger = await createWinstonLogger({ level: "warn", color: false });
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

    test("Should create debug logger", async () => {
      const logger = await createWinstonLogger({ level: "debug", color: true });
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

    test("Should manage profiling", async () => {
      const logger = await createWinstonLogger({ level: "debug", color: true });
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

    test("Should handle empty message", async () => {
      const logger = await createWinstonLogger({ level: "debug", color: true });
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
  });
});
