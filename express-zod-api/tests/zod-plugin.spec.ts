import camelize from "camelize-ts";
import { z } from "zod";
import { ezRegistry } from "../src/metadata";

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
      expect(ezRegistry.get(schemaWithMeta)).toHaveProperty("examples", [
        "test",
      ]);
    });

    test("Issue 827: should be immutable", () => {
      const schema = z.string();
      const schemaWithExample = schema.example("test");
      expect(ezRegistry.get(schemaWithExample)?.examples).toEqual(["test"]);
      expect(ezRegistry.get(schema)).toBeUndefined();
      const second = schemaWithExample.example("test2");
      expect(ezRegistry.get(second)?.examples).toEqual(["test", "test2"]);
      expect(ezRegistry.get(schemaWithExample)?.examples).toEqual(["test"]);
    });

    test("can be used multiple times", () => {
      const schema = z.string();
      const schemaWithMeta = schema
        .example("test1")
        .example("test2")
        .example("test3");
      expect(ezRegistry.get(schemaWithMeta)?.examples).toEqual([
        "test1",
        "test2",
        "test3",
      ]);
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
      expect(schemaWithMeta.meta()).toHaveProperty("deprecated", true);
    });
  });

  describe(".label()", () => {
    test("should set the corresponding metadata in the schema definition", () => {
      const schema = z.iso.datetime().default(() => new Date().toISOString());
      expect(schema).toHaveProperty("label");
      const schemaWithMeta = schema.label("Today");
      expect(ezRegistry.get(schemaWithMeta)).toHaveProperty(
        "defaultLabel",
        "Today",
      );
    });
  });

  describe(".brand()", () => {
    test("should set the brand", () => {
      expect(ezRegistry.get(z.string().brand("test"))?.brand).toEqual("test");
    });

    test("should withstand refinements", () => {
      const schema = z.string();
      const schemaWithMeta = schema.brand("test");
      expect(ezRegistry.get(schemaWithMeta)).toHaveProperty("brand", "test");
      expect(
        ezRegistry.get(schemaWithMeta.regex(/@example.com$/)),
      ).toHaveProperty("brand", "test");
    });

    test("should withstand describing", () => {
      const schema = z.string().brand("test").describe("something");
      expect(ezRegistry.get(schema)?.brand).toBe("test");
    });
  });

  describe(".remap()", () => {
    test("should transform and pipe the object schema keys", () => {
      const schema = z.object({ user_id: z.string() });
      const mappedSchema = schema.remap({ user_id: "userId" });
      expect(mappedSchema.in.in).toEqual(schema);
      expect(mappedSchema.out.shape).toEqual({
        userId: schema.shape.user_id,
      });
      expect(mappedSchema._zod.def.out.shape.userId).not.toBe(
        schema.shape.user_id,
      );
      expect(mappedSchema.parse({ user_id: "test" })).toEqual({
        userId: "test",
      });
    });

    test.each([{ user_id: "userId" }, { user_id: "userId", name: undefined }])(
      "should support partial mapping %#",
      (mapping) => {
        const schema = z.object({ user_id: z.string(), name: z.string() });
        const mappedSchema = schema.remap(mapping);
        expect(mappedSchema._zod.def.out.shape).toEqual({
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
      expect(mappedSchema._zod.def.out.shape).toEqual({
        userId: schema.shape.user_id,
        name: schema.shape.name,
      });
      expect(mappedSchema.parse({ user_id: "test", name: "some" })).toEqual({
        userId: "test",
        name: "some",
      });
    });

    test("should support passthrough object schemas", () => {
      const schema = z.looseObject({ user_id: z.string() });
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
