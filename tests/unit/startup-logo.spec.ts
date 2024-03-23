import { getStartupLogo } from "../../src/startup-logo";
import { describe, expect, test } from "vitest";

describe("Startup logo", () => {
  describe("getStartupLogo()", () => {
    test("should return the logo", async () => {
      expect((await getStartupLogo()).split("\n").length).toBe(14);
    });
  });
});
