import { getBrand } from "../src/metadata";
import type { z } from "zod";

describe("Metadata", () => {
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
