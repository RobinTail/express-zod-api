import { getStartupLogo } from "./startup-logo";

describe("Startup logo", () => {
  describe("getStartupLogo()", () => {
    test("should return the logo", () => {
      expect(getStartupLogo().split("\n").length).toBe(16);
    });
  });
});
