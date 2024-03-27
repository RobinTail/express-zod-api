import { getStartupLogo } from "../../src/startup-logo";
import { describe, expect, test } from "vitest";
import chalk from "chalk";

describe("Startup logo", () => {
  describe("getStartupLogo()", () => {
    test("should return the logo", () => {
      expect(getStartupLogo(chalk).split("\n").length).toBe(14);
    });
  });
});
