import { BuiltinLogger } from "../../src";
import { BuiltinLoggerConfig } from "../../src/builtin-logger";
import {
  AbstractLogger,
  isLoggerInstance,
  isSeverity,
  isHidden,
} from "../../src/logger-helpers";

describe("Logger helpers", () => {
  describe("isSeverity()", () => {
    test.each(["debug", "info", "warn", "error"])(
      "should recognize %s",
      (subject) => {
        expect(isSeverity(subject)).toBeTruthy();
      },
    );
    test.each(["something", "", 123, Symbol.dispose])(
      "should reject others %#",
      (subject) => {
        expect(isSeverity(subject)).toBeFalsy();
      },
    );
  });

  describe("isHidden", () => {
    test.each([
      ["debug", "debug", false],
      ["debug", "info", true],
      ["debug", "warn", true],
      ["debug", "error", true],
      ["info", "debug", false],
      ["info", "info", false],
      ["info", "warn", true],
      ["info", "error", true],
      ["warn", "debug", false],
      ["warn", "info", false],
      ["warn", "warn", false],
      ["warn", "error", true],
      ["error", "debug", false],
      ["error", "info", false],
      ["error", "warn", false],
      ["error", "error", false],
    ] as const)(
      "should compare %s to %s with %s result",
      (subject, gate, result) => {
        expect(isHidden(subject, gate)).toBe(result);
      },
    );
  });

  describe("isLoggerInstance()", () => {
    test.each<BuiltinLoggerConfig>([
      { level: "silent" },
      { level: "debug", color: false },
      { level: "info", color: true },
      { level: "warn", depth: 5 },
      { level: "warn", depth: null },
      { level: "warn", depth: Infinity },
    ])("should invalidate built-in logger config %#", (sample) => {
      expect(isLoggerInstance(sample)).toBeFalsy();
    });

    test.each<AbstractLogger>([
      // issue #1605: should not allow methods
      { level: "debug", debug: () => {} },
      { level: "warn", error: () => {} },
      // issue #1772: similar to #1605, but the methods are in prototype
      new (class {
        level = "debug";
        debug() {}
      })(),
      Object.setPrototypeOf({ level: "debug" }, { debug: () => {} }),
      new BuiltinLogger({ level: "debug" }),
    ])("should validate logger instances %#", (sample) => {
      expect(isLoggerInstance(sample)).toBeTruthy();
    });
  });
});
