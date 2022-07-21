import { getStartupLogo } from "../../src/startup-logo.js";

describe("Startup logo", () => {
  describe("getStartupLogo()", () => {
    test("should return the logo", () => {
      expect(getStartupLogo().split("\n").length).toBe(16);
    });
  });
});
