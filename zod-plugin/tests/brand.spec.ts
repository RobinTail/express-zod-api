import { brandProperty } from "../src/brand";

describe("Brand", () => {
  describe("brandProperty", () => {
    test("should be brand", () => {
      expect(brandProperty).toBe("x-brand");
    });
  });
});
