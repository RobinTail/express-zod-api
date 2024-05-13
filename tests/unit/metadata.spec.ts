import { z } from "zod";
import { copyMeta, metaSymbol } from "../../src/metadata";
import { describe, expect, test } from "vitest";

describe("Metadata", () => {
  describe(".example()", () => {
    test("should be present", () => {
      const schema = z.string();
      expect(schema).toHaveProperty("example");
      expect(typeof schema.example).toBe("function");
    });

    test("should set the corresponding metadata in the schema definition", () => {
      const schema = z.string();
      const schemaWithMeta = schema.example("test");
      expect(schemaWithMeta._def[metaSymbol]).toHaveProperty("examples", [
        "test",
      ]);
    });

    test("Issue 827: should be immutable", () => {
      const schema = z.string();
      const schemaWithExample = schema.example("test");
      expect(schemaWithExample._def[metaSymbol]?.examples).toEqual(["test"]);
      expect(schema._def[metaSymbol]).toBeUndefined();
    });

    test("can be used multiple times", () => {
      const schema = z.string();
      const schemaWithMeta = schema
        .example("test1")
        .example("test2")
        .example("test3");
      expect(schemaWithMeta._def[metaSymbol]?.examples).toEqual([
        "test1",
        "test2",
        "test3",
      ]);
    });

    test("should withstand refinements", () => {
      const schema = z.string();
      const schemaWithMeta = schema.example("test");
      expect(schemaWithMeta._def[metaSymbol]?.examples).toEqual(["test"]);
      expect(schemaWithMeta.email()._def[metaSymbol]).toEqual({
        examples: ["test"],
      });
    });
  });

  describe(".label()", () => {
    test("should set the corresponding metadata in the schema definition", () => {
      const schema = z
        .string()
        .datetime()
        .default(() => new Date().toISOString());
      const schemaWithMeta = schema.label("Today");
      expect(schemaWithMeta._def[metaSymbol]).toHaveProperty(
        "defaultLabel",
        "Today",
      );
    });
  });

  describe(".brand()", () => {
    test("should set the brand", () => {
      expect(z.string().brand("test")._def[metaSymbol]?.brand).toEqual("test");
    });
  });

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
  });
});
