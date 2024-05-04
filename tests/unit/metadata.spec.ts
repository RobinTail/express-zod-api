import { expectType } from "tsd";
import { z } from "zod";
import { withMeta } from "../../src";
import { copyMeta, getMeta, hasMeta, metaSymbol } from "../../src/metadata";
import { describe, expect, test } from "vitest";

describe("Metadata", () => {
  describe("withMeta()", () => {
    test("should be present for backward compatibility", () => {
      const schema = z.string();
      const schemaWithMeta = withMeta(schema);
      expect(schemaWithMeta).toEqual(schema);
      expectType<z.ZodString>(schemaWithMeta);
    });
  });

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

  describe("hasMeta()", () => {
    test("should return false if the schema definition has no meta prop", () => {
      expect(hasMeta(z.string())).toBeFalsy();
    });
    test("should return false if the meta prop has invalid type", () => {
      const schema1 = z.string();
      const schema2 = z.string();
      Object.defineProperty(schema1._def, metaSymbol, { value: null });
      expect(hasMeta(schema1)).toBeFalsy();
      Object.defineProperty(schema2._def, metaSymbol, { value: 123 });
      expect(hasMeta(schema2)).toBeFalsy();
    });
    test("should return true if proprietary method has been used", () => {
      expect(hasMeta(z.string().example(""))).toBeTruthy();
    });
  });

  describe("getMeta()", () => {
    test("should return undefined on a regular Zod schema or the malformed one", () => {
      expect(getMeta(z.string(), "examples")).toBeUndefined();
    });
    test("should return undefined on malformed schema", () => {
      const schema1 = z.string();
      const schema2 = z.string();
      Object.defineProperty(schema1._def, metaSymbol, { value: null });
      expect(getMeta(schema1, "examples")).toBeUndefined();
      Object.defineProperty(schema2._def, metaSymbol, { value: 123 });
      expect(getMeta(schema2, "examples")).toBeUndefined();
    });
    test("should return undefined if the value not set", () => {
      expect(getMeta(z.string(), "examples")).toBeUndefined();
    });
    test("should return the value that has been set", () => {
      expect(getMeta(z.string().example("test"), "examples")).toEqual(["test"]);
    });
    test("should return an array of examples", () => {
      expect(
        getMeta(z.string().example("test1").example("test2"), "examples"),
      ).toEqual(["test1", "test2"]);
    });
  });

  describe("copyMeta()", () => {
    test("should return the same dest schema in case src one has no meta", () => {
      const src = z.string();
      const dest = z.number();
      const result = copyMeta(src, dest);
      expect(result).toEqual(dest);
      expect(hasMeta(result)).toBeFalsy();
      expect(hasMeta(dest)).toBeFalsy();
    });
    test("should copy meta from src to dest in case meta is defined", () => {
      const src = z.string().example("some");
      const dest = z.number();
      const result = copyMeta(src, dest);
      expect(hasMeta(result)).toBeTruthy();
      expect(getMeta(result, "examples")).toEqual(getMeta(src, "examples"));
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
      expect(hasMeta(result)).toBeTruthy();
      expect(getMeta(result, "examples")).toEqual([
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
      expect(hasMeta(result)).toBeTruthy();
      expect(getMeta(result, "examples")).toEqual([
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
