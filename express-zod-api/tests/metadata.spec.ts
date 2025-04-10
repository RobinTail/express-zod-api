import { z } from "zod";
import { copyMeta, metaSymbol } from "../src/metadata";

describe("Metadata", () => {
  describe("copyMeta()", () => {
    test("should return the same dest schema in case src one has no meta", () => {
      const src = z.string();
      const dest = z.number();
      const result = copyMeta(src, dest);
      expect(result).toEqual(dest);
      expect(result._def[metaSymbol]).toBeFalsy();
      expect(dest._def[metaSymbol]).toBeFalsy();
    });
    test("should copy meta from src to dest in case meta is defined", () => {
      const src = z.string().example("some");
      const dest = z.number();
      const result = copyMeta(src, dest);
      expect(result._def[metaSymbol]).toBeTruthy();
      expect(result._def[metaSymbol]?.examples).toEqual(
        src._def[metaSymbol]?.examples,
      );
    });

    test("should merge the meta from src to dest", () => {
      const src = z
        .object({ a: z.string() })
        .example({ a: "some" })
        .example({ a: "another" });
      const dest = z
        .object({ b: z.number() })
        .example({ b: 123 })
        .example({ b: 456 })
        .example({ b: 789 });
      const result = copyMeta(src, dest);
      expect(result._def[metaSymbol]).toBeTruthy();
      expect(result._def[metaSymbol]?.examples).toEqual([
        { a: "some", b: 123 },
        { a: "another", b: 123 },
        { a: "some", b: 456 },
        { a: "another", b: 456 },
        { a: "some", b: 789 },
        { a: "another", b: 789 },
      ]);
    });

    test("should merge deeply", () => {
      const src = z
        .object({ a: z.object({ b: z.string() }) })
        .example({ a: { b: "some" } })
        .example({ a: { b: "another" } });
      const dest = z
        .object({ a: z.object({ c: z.number() }) })
        .example({ a: { c: 123 } })
        .example({ a: { c: 456 } })
        .example({ a: { c: 789 } });
      const result = copyMeta(src, dest);
      expect(result._def[metaSymbol]).toBeTruthy();
      expect(result._def[metaSymbol]?.examples).toEqual([
        { a: { b: "some", c: 123 } },
        { a: { b: "another", c: 123 } },
        { a: { b: "some", c: 456 } },
        { a: { b: "another", c: 456 } },
        { a: { b: "some", c: 789 } },
        { a: { b: "another", c: 789 } },
      ]);
    });

    test("should avoid non-object examples", () => {
      const src = z.string().example("a").example("b");
      const dest = z
        .object({ items: z.array(z.string()) })
        .example({ items: ["e", "f", "g"] });
      const result = copyMeta(src, dest);
      expect(result._def[metaSymbol]?.examples).toEqual(["a", "b"]);
    });
  });
});
