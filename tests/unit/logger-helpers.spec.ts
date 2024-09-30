import { BuiltinLogger } from "../../src";
import { BuiltinLoggerConfig } from "../../src/builtin-logger";
import {
  AbstractLogger,
  formatDuration,
  isLoggerInstance,
  isSeverity,
  sevCompare,
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

  describe("sevCompare", () => {
    test.each([
      ["debug", "debug", 0],
      ["debug", "info", -10],
      ["debug", "warn", -20],
      ["debug", "error", -30],
      ["info", "debug", 10],
      ["info", "info", 0],
      ["info", "warn", -10],
      ["info", "error", -20],
      ["warn", "debug", 20],
      ["warn", "info", 10],
      ["warn", "warn", 0],
      ["warn", "error", -10],
      ["error", "debug", 30],
      ["error", "info", 20],
      ["error", "warn", 10],
      ["error", "error", 0],
    ] as const)(
      "should compare %s to %s with %i result",
      (subject, reference, result) => {
        expect(sevCompare(subject, reference)).toBe(result);
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

  describe("formatDuration()", () => {
    test.each([
      1e-9, 1e-8, 1e-7, 1e-6, 1e-5, 1e-4, 1e-3, 1e-2, 1e-1, 1, 1e1, 1e2, 1e3,
      15e2, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9,
    ])("%# should format %s ms", (duration) =>
      expect(formatDuration(duration)).toMatchSnapshot(),
    );
  });
});
