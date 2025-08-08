import type { z } from "zod";
import { brandProperty, getBrand } from "./brand";

describe("Brand", () => {
  describe("brandProperty", () => {
    test("should be brand", () => {
      expect(brandProperty).toBe("brand");
    });
  });

  describe("getBrand", () => {
    test.each([{ brand: "test" }, {}, undefined])(
      "should take it from bag",
      (bag) => {
        const mock = { _zod: { bag } };
        expect(getBrand(mock as unknown as z.core.$ZodType)).toBe(bag?.brand);
      },
    );
  });
});
