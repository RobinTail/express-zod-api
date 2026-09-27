import { globalRegistry, z } from "zod";
import {
  brandProperty,
  getBrand,
  getExamples,
  findIdentified,
} from "../src/metadata";

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
    test.each([true, null, new Date()])(
      "should ignore invalid values %#",
      (brand) => {
        const subject = z.string();
        globalRegistry.add(subject, { [brandProperty]: brand });
        expect(getBrand(subject)).toBeUndefined();
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

    test.each([{}, 123, true, "test"])(
      "should ignore invalid values %#",
      (examples) => {
        const subject = z.number();
        globalRegistry.add(subject, { examples });
        expect(getExamples(subject)).toEqual([]);
      },
    );
  });

  describe("findIdentified()", () => {
    const origin = z.object({ name: z.string() }).meta({ id: "Origin" });

    test.each([
      origin,
      origin.describe("clone"),
      z.compile(origin),
      z.compile(origin.describe("clone")), // two levels: compiled, described, origin
    ])("should find the schema or its origin having the id %#", (subject) => {
      expect(findIdentified(subject)).toEqual({
        id: "Origin",
        schema: origin,
      });
    });

    test.each([origin.optional(), origin.extend({}), z.object({})])(
      "should not find it for the derived or other schemas %#",
      (subject) => {
        expect(findIdentified(subject)).toBeUndefined();
      },
    );
  });
});
