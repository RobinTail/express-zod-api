import { z } from "zod";
import { brandProperty, getBrand, setBrand } from "../src/brand";
import * as packer from "../src/packer";

describe("Brand", () => {
  describe("brandProperty", () => {
    test("should be brand", () => {
      expect(brandProperty).toBe("brand");
    });
  });

  describe("setBrand", () => {
    const packMock = vi.spyOn(packer, "pack");

    afterAll(() => {
      packMock.mockRestore();
    });

    test("calls pack() with given brand", () => {
      const schema = z.string();
      setBrand.call(schema, "test");
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
