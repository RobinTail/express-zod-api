import { BuiltinLogger } from "../../src";
import { BuiltinLoggerConfig } from "../../src/builtin-logger";
import {
  AbstractLogger,
  formatDuration,
  isLoggerInstance,
} from "../../src/logger-helpers";
import { describe, expect, test } from "vitest";

describe("Logger helpers", () => {
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
    test.each([1e-9, 1e-6, 1e-3, 1, 1e3, 1e6, 1e9])(
      "%# should format %s ms",
      (duration) => expect(formatDuration(duration)).toMatchSnapshot(),
    );
  });
});
