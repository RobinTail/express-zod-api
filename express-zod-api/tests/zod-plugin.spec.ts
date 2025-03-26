import "../src/zod-plugin.ts"; // required for this test
import camelize from "camelize-ts";
import { z } from "zod";
import { metaSymbol } from "../src/metadata.ts";

describe("Zod Runtime Plugin", () => {
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

  describe(".deprecated()", () => {
    test("should be present", () => {
      const schema = z.string();
      expect(schema).toHaveProperty("deprecated");
      expect(typeof schema.deprecated).toBe("function");
    });

    test("should set the corresponding metadata in the schema definition", () => {
      const schema = z.string();
      const schemaWithMeta = schema.deprecated();
      expect(schemaWithMeta._def[metaSymbol]).toHaveProperty(
        "isDeprecated",
        true,
      );
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

  describe(".remap()", () => {
    test("should transform and pipe the object schema keys", () => {
      const schema = z.object({ user_id: z.string() });
      const mappedSchema = schema.remap({ user_id: "userId" });
      expect(mappedSchema._def.in._def.schema).toEqual(schema);
      expect(mappedSchema._def.out.shape).toEqual({
        userId: schema.shape.user_id,
      });
      expect(mappedSchema._def.out.shape.userId).not.toBe(schema.shape.user_id);
      expect(mappedSchema.parse({ user_id: "test" })).toEqual({
        userId: "test",
      });
    });

    test.each([{ user_id: "userId" }, { user_id: "userId", name: undefined }])(
      "should support partial mapping %#",
      (mapping) => {
        const schema = z.object({ user_id: z.string(), name: z.string() });
        const mappedSchema = schema.remap(mapping);
        expect(mappedSchema._def.out.shape).toEqual({
          userId: schema.shape.user_id,
          name: schema.shape.name,
        });
        expect(mappedSchema.parse({ user_id: "test", name: "some" })).toEqual({
          userId: "test",
          name: "some",
        });
      },
    );

    test("should support a mapping function", () => {
      const schema = z.object({ user_id: z.string(), name: z.string() });
      const mappedSchema = schema.remap((shape) => camelize(shape, true));
      expect(mappedSchema._def.out.shape).toEqual({
        userId: schema.shape.user_id,
        name: schema.shape.name,
      });
      expect(mappedSchema.parse({ user_id: "test", name: "some" })).toEqual({
        userId: "test",
        name: "some",
      });
    });

    test("should support passthrough object schemas", () => {
      const schema = z.object({ user_id: z.string() }).passthrough();
      const mappedSchema = schema.remap({ user_id: "userId" });
      expect(
        mappedSchema.parse({ user_id: "test", extra: "excessive" }),
      ).toEqual({
        userId: "test",
        extra: "excessive",
      });
    });
  });
});
