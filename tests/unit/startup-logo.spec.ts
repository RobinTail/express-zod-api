import { getStartupLogo } from "../../src/startup-logo";

describe("Startup logo", () => {
  describe("getStartupLogo()", () => {
    test("should return the logo", () => {
      const logo = getStartupLogo();
      expect(logo.split("\n").length).toBeGreaterThanOrEqual(12);
      expect(logo).toMatch(
        /Thank you for choosing Express Zod API for your project/,
      );
    });
  });
});
