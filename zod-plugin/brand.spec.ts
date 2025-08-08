import { z } from "zod";
import { brandProperty, getBrand, setBrand } from "./brand";
import * as packer from "./packer";

describe("Brand", () => {
  describe("brandProperty", () => {
    test("should be brand", () => {
      expect(brandProperty).toBe("brand");
    });
  });

  describe("setBrand", () => {
    test("calls pack() with given brand", () => {
      const packMock = vi.spyOn(packer, "pack");
      const schema = z.string();
      setBrand?.call(schema, "test");
      expect(packMock).toHaveBeenCalledWith(schema, { brand: "test" });
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
