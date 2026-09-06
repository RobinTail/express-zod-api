import { brandProperty } from "../src/shared";

describe("Brand", () => {
  describe("brandProperty", () => {
    test("should be brand", () => {
      expect(brandProperty).toBe("x-brand");
    });
  });
});
