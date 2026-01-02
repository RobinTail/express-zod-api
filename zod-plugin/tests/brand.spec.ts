import { z, globalRegistry } from "zod";
import { brandProperty, getBrand, setBrand } from "../src/brand";

describe("Brand", () => {
  describe("brandProperty", () => {
    test("should be brand", () => {
      expect(brandProperty).toBe("x-brand");
    });
  });

  describe("setBrand", () => {
    test("calls meta() with given brand", () => {
      const parent = z.string();
      const subject = setBrand.call(parent, "test");
      expect(subject.meta()).toHaveProperty("x-brand", "test");
    });
  });

  describe("getBrand", () => {
    test.each([{ [brandProperty]: "test" }, {}, undefined])(
      "should take it from metadata in globalRegistry %#",
      (metadata) => {
        const subject = z.string();
        if (metadata) globalRegistry.add(subject, metadata);
        expect(getBrand(subject)).toBe(metadata?.[brandProperty]);
      },
    );
  });
});
