import type { $ZodType } from "zod/v4/core";
import { getBrand } from "../src/metadata";

describe("Metadata", () => {
  describe("getBrand", () => {
    test.each([{ brand: "test" }, {}, undefined])(
      "should take it from bag",
      (bag) => {
        const mock = { _zod: { bag } };
        expect(getBrand(mock as unknown as $ZodType)).toBe(bag?.brand);
      },
    );
  });
});
