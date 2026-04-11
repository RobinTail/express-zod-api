import { globalRegistry, z } from "zod";
import { brandProperty, getBrand, getExamples } from "../src/metadata.ts";

describe("Metadata helpers", () => {
  describe("getBrand()", () => {
    test.each([{ [brandProperty]: "test" }, {}, undefined])(
      "should take it from metadata in globalRegistry %#",
      (metadata) => {
        const subject = z.string();
        if (metadata) globalRegistry.add(subject, metadata);
        expect(getBrand(subject)).toBe(metadata?.[brandProperty]);
      },
    );
  });

  describe("getExamples()", () => {
    test.each([
      { examples: [123, 456] },
      { examples: [] },
      { examples: undefined },
      {},
    ])("always returns an array %#", (metadata) => {
      const subject = z.number();
      globalRegistry.add(subject, metadata);
      expect(getExamples(subject)).toEqual(metadata.examples ?? []);
    });
  });
});
