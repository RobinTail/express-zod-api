import MockDate from "mockdate";
import { EventEmitter } from "node:events";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import { BuiltinLogger, BuiltinLoggerConfig } from "../../src/builtin-logger";

describe("BuiltinLogger", () => {
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

  const makeLogger = (props: BuiltinLoggerConfig) => {
    const logger = new BuiltinLogger({ ...props });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    return { logger, logSpy };
  };

  describe("constructor()", () => {
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
      child.info("Here is some message", { more: "information" });
      expect(logSpy.mock.calls).toMatchSnapshot();
    });
  });

  describe("profile()", () => {
    test.each([10, 100, 1000])(
      "should measure the time during the calls with the same label",
      async (delay) => {
        const { logger, logSpy } = makeLogger({ level: "debug", color: false });
        logger.profile("test");
        await new Promise((resolve) => setTimeout(resolve, delay));
        logger.profile("test");
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringMatching(
            /2022-01-01T00:00:00.000Z debug: test '[\d.,]+ ms'/,
          ),
        );
      },
    );
  });
});
