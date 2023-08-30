import { getStartupLogo } from "../../src/startup-logo";

describe("Startup logo", () => {
  describe("getStartupLogo()", () => {
    test("should return the logo", () => {
      console.log(getStartupLogo(), getStartupLogo().split("\n"));
      expect(getStartupLogo().split("\n").length).toBe(16);
    });
  });
});
