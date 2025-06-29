import { z } from "zod/v4";
import type { $ZodType, GlobalMeta } from "zod/v4/core";
import { getBrand, getExamples } from "../src/metadata";

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

  describe("getExamples()", () => {
    test.each<GlobalMeta>([
      { examples: [1, 2, 3] },
      { examples: [] },
      { examples: undefined },
      { examples: { one: { value: 123 } } },
      { example: 123 },
      { example: 0 },
      { example: undefined },
      { examples: [1, 2, 3], example: 123 }, // priority
      {},
    ])("should handle %s", (meta) => {
      const schema = z.unknown().meta(meta);
      expect(getExamples(schema)).toMatchSnapshot();
    });
  });
});
