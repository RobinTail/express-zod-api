import { z } from "zod";
import { copyMeta, getMeta, withMeta } from "../../src/metadata";
import { describe, expect, test } from "vitest";

describe("Metadata", () => {
  describe("withMeta()", () => {
    test("should return the similar schema", () => {
      const schema = z.string();
      const schemaWithMeta = withMeta(schema);
      expect(schemaWithMeta).toBeInstanceOf(z.ZodString);
      expect(schemaWithMeta.description).toBe('{"examples":[]}');
    });

    test("should provide example() method", () => {
      const schema = z.string();
      const schemaWithMeta = withMeta(schema);
      expect(schemaWithMeta).toHaveProperty("example");
      expect(typeof schemaWithMeta.example).toBe("function");
    });

    test("example() should set the corresponding metadata in the schema definition", () => {
      const schema = z.string();
      const schemaWithMeta = withMeta(schema).example("test");
      expect(schemaWithMeta.description).toBe('{"examples":["test"]}');
    });

    test("Issue 827: example() should be immutable", () => {
      const schemaWithMeta = withMeta(z.string());
      const schemaWithExample = schemaWithMeta.example("test");
      expect(schemaWithExample.description).toBe('{"examples":["test"]}');
      expect(schemaWithMeta.description).toBe('{"examples":[]}');
    });

    test("example() can set multiple examples", () => {
      const schema = z.string();
      const schemaWithMeta = withMeta(schema)
        .example("test1")
        .example("test2")
        .example("test3");
      expect(schemaWithMeta.description).toBe(
        '{"examples":["test1","test2","test3"]}',
      );
    });

    test("metadata should withstand refinements", () => {
      const schema = z.string();
      const schemaWithMeta = withMeta(schema).example("test");
      expect(schemaWithMeta.description).toBe('{"examples":["test"]}');
      expect(schemaWithMeta.email().description).toBe('{"examples":["test"]}');
    });

    test("metadata should withstand double withMeta()", () => {
      const schema = z.string();
      const schemaWithMeta = withMeta(schema).example("test");
      expect(withMeta(schemaWithMeta).description).toBe(
        '{"examples":["test"]}',
      );
      expect(withMeta(schemaWithMeta).example("another").description).toBe(
        '{"examples":["test","another"]}',
      );
    });

    test("metadata should withstand calling describe() by consumer", () => {
      const schema = withMeta(z.string()).example("test");
      const describedSchema = schema.describe("some string");
      expect(schema.description).toBe('{"examples":["test"]}');
      expect(describedSchema.description).toBe(
        '{"examples":["test"],"description":"some string"}',
      );
      expect(describedSchema).toHaveProperty("example"); // and also remain being proxy
    });
  });

  describe("getMeta()", () => {
    test("should return initial value on a regular Zod schema", () => {
      expect(getMeta(z.string(), "examples")).toEqual([]);
    });
    test("should return initial value on malformed schema", () => {
      const schema1 = z.string().describe(JSON.stringify(null));
      const schema2 = z.string().describe(JSON.stringify(123));
      expect(getMeta(schema1, "examples")).toEqual([]);
      expect(getMeta(schema2, "examples")).toEqual([]);
    });
    test("should return initial value if the value not set", () => {
      expect(getMeta(withMeta(z.string()), "examples")).toEqual([]);
    });
    test("should return the value that has been set", () => {
      expect(getMeta(withMeta(z.string()).example("test"), "examples")).toEqual(
        ["test"],
      );
    });
    test("should return an array of examples", () => {
      expect(getMeta(withMeta(z.string()), "examples")).toEqual([]);
      expect(
        getMeta(
          withMeta(z.string()).example("test1").example("test2"),
          "examples",
        ),
      ).toEqual(["test1", "test2"]);
    });
  });

  describe("copyMeta()", () => {
    test("should return cloned dest schema with initial meta in case src one has no meta", () => {
      const src = z.string();
      const dest = z.number();
      const result = copyMeta(src, dest);
      expect(result._def.typeName).toBe(dest._def.typeName);
      expect(result.description).toBe('{"examples":[]}');
      expect(dest.description).toBeUndefined();
    });
    test("should copy meta from src to dest in case meta is defined", () => {
      const src = withMeta(z.string()).example("some");
      const dest = z.number();
      const result = copyMeta(src, dest);
      expect(getMeta(result, "examples")).toEqual(getMeta(src, "examples"));
    });

    test("should merge the meta from src to dest (deep merge)", () => {
      const src = withMeta(z.object({ a: z.string() }))
        .example({ a: "some" })
        .example({ a: "another" });
      const dest = withMeta(z.object({ b: z.number() }))
        .example({ b: 123 })
        .example({ b: 456 })
        .example({ b: 789 });
      const result = copyMeta(src, dest);
      expect(getMeta(result, "examples")).toEqual([
        { a: "some", b: 123 },
        { a: "another", b: 123 },
        { a: "some", b: 456 },
        { a: "another", b: 456 },
        { a: "some", b: 789 },
        { a: "another", b: 789 },
      ]);
    });
  });
});
