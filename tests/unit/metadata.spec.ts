import { z } from "zod";
import { withMeta } from "../../src";
import {
  MetaDef,
  copyMeta,
  getMeta,
  hasMeta,
  metaProp,
} from "../../src/metadata";

describe("Metadata", () => {
  describe("withMeta()", () => {
    test("should return the similar schema", () => {
      const schema = z.string();
      const schemaWithMeta = withMeta(schema);
      expect(schemaWithMeta).toBeInstanceOf(z.ZodString);
      expect(schemaWithMeta).toEqual(schema);
      expect(metaProp).toBe("expressZodApiMeta");
      expect(schemaWithMeta._def).toHaveProperty(metaProp);
      expect(schemaWithMeta._def[metaProp]).toEqual({ examples: [] });
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
      expect(schemaWithMeta._def[metaProp]).toHaveProperty("examples");
      expect(schemaWithMeta._def[metaProp].examples).toEqual(["test"]);
    });

    test("example() can set multiple examples", () => {
      const schema = z.string();
      const schemaWithMeta = withMeta(schema)
        .example("test1")
        .example("test2")
        .example("test3");
      expect(schemaWithMeta._def[metaProp].examples).toEqual([
        "test1",
        "test2",
        "test3",
      ]);
    });

    test("metadata should withstand refinements", () => {
      const schema = z.string();
      const schemaWithMeta = withMeta(schema).example("test");
      expect(schemaWithMeta._def[metaProp].examples).toEqual(["test"]);
      expect(
        (
          schemaWithMeta.email()._def as unknown as MetaDef<
            typeof schemaWithMeta
          >
        )[metaProp].examples
      ).toEqual(["test"]);
    });

    test("metadata should withstand double withMeta()", () => {
      const schema = z.string();
      const schemaWithMeta = withMeta(schema).example("test");
      expect(withMeta(schemaWithMeta)._def[metaProp].examples).toEqual([
        "test",
      ]);
      expect(
        withMeta(schemaWithMeta).example("another")._def[metaProp].examples
      ).toEqual(["test", "another"]);
    });
  });

  describe("hasMeta()", () => {
    test("should return false if the schema definition has no meta prop", () => {
      expect(hasMeta(z.string())).toBeFalsy();
    });
    test("should return false if the meta prop has invalid type", () => {
      const schema1 = z.string();
      const schema2 = z.string();
      Object.defineProperty(schema1._def, metaProp, { value: null });
      expect(hasMeta(schema1)).toBeFalsy();
      Object.defineProperty(schema2._def, metaProp, { value: 123 });
      expect(hasMeta(schema2)).toBeFalsy();
    });
    test("should return true if withMeta() has been used", () => {
      expect(hasMeta(withMeta(z.string()))).toBeTruthy();
    });
  });

  describe("getMeta()", () => {
    test("should return undefined on a regular Zod schema or the malformed one", () => {
      expect(getMeta(z.string(), "examples")).toBeUndefined();
    });
    test("should return undefined on malformed schema", () => {
      const schema1 = z.string();
      const schema2 = z.string();
      Object.defineProperty(schema1._def, metaProp, { value: null });
      expect(getMeta(schema1, "examples")).toBeUndefined();
      Object.defineProperty(schema2._def, metaProp, { value: 123 });
      expect(getMeta(schema2, "examples")).toBeUndefined();
    });
    test("should return initial value if the value not set", () => {
      expect(getMeta(withMeta(z.string()), "examples")).toEqual([]);
    });
    test("should return the value that has been set", () => {
      expect(getMeta(withMeta(z.string()).example("test"), "examples")).toEqual(
        ["test"]
      );
    });
    test("should return an array of examples", () => {
      expect(getMeta(withMeta(z.string()), "examples")).toEqual([]);
      expect(
        getMeta(
          withMeta(z.string()).example("test1").example("test2"),
          "examples"
        )
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
      const src = withMeta(z.string()).example("some");
      const dest = z.number();
      const result = copyMeta(src, dest);
      expect(hasMeta(result)).toBeTruthy();
      expect(getMeta(result, "examples")).toEqual(getMeta(src, "examples"));
      expect(result).toEqual(dest);
    });

    test("should merge the meta from src to dest (deep merge)", () => {
      const src = withMeta(
        z.object({
          a: z.string(),
        })
      )
        .example({
          a: "some",
        })
        .example({
          a: "another",
        });
      const dest = withMeta(
        z.object({
          b: z.number(),
        })
      )
        .example({
          b: 123,
        })
        .example({
          b: 456,
        })
        .example({
          b: 789,
        });
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
      expect(result).toEqual(dest);
    });
  });
});
