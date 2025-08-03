import "./index"; // required, @todo move to vitest.setup
import camelize from "camelize-ts";
import { z } from "zod";

describe("Zod Runtime Plugin", () => {
  test("Extended Zod prototypes", () => {
    expectTypeOf<z.ZodAny>()
      .toHaveProperty("example")
      .toEqualTypeOf<(value: any) => z.ZodAny>();
    expectTypeOf<z.ZodDefault<z.ZodString>>()
      .toHaveProperty("example")
      .toEqualTypeOf<(value: string) => z.ZodDefault<z.ZodString>>();
    expectTypeOf<z.ZodDefault<z.ZodString>>()
      .toHaveProperty("label")
      .toEqualTypeOf<(value: string) => z.ZodDefault<z.ZodString>>();
    expectTypeOf<z.ZodObject>().toHaveProperty("remap");
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
      expect(schemaWithMeta.meta()?.examples).toEqual(["test"]);
    });

    test("Issue 827: should be immutable", () => {
      const schema = z.string();
      const schemaWithExample = schema.example("test");
      expect(schemaWithExample.meta()?.examples).toEqual(["test"]);
      const second = schemaWithExample.example("test2");
      expect(second.meta()?.examples).toEqual(["test", "test2"]);
      expect(schemaWithExample.meta()?.examples).toEqual(["test"]);
    });

    test("can be used multiple times", () => {
      const schema = z.string();
      const schemaWithMeta = schema
        .example("test1")
        .example("test2")
        .example("test3");
      expect(schemaWithMeta.meta()?.examples).toEqual([
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
      expect(schemaWithMeta.meta()).toHaveProperty("default", "Today");
    });
  });

  describe(".brand()", () => {
    test("should set the brand", () => {
      expect(z.string().brand("test")).toHaveProperty(
        ["_zod", "bag", "brand"],
        "test",
      );
    });

    test("should withstand refinements", () => {
      const schema = z.string();
      const schemaWithMeta = schema.brand("test");
      expect(schemaWithMeta).toHaveProperty(["_zod", "bag", "brand"], "test");
      expect(schemaWithMeta.regex(/@example.com$/)).toHaveProperty(
        ["_zod", "bag", "brand"],
        "test",
      );
    });

    test("should withstand describing", () => {
      const schema = z.string().brand("test").describe("something");
      expect(schema).toHaveProperty(["_zod", "bag", "brand"], "test");
    });
  });

  describe(".remap()", () => {
    test("should transform and pipe the object schema keys", () => {
      const schema = z.object({ user_id: z.string() });
      const mappedSchema = schema.remap({ user_id: "userId" });
      expect(mappedSchema.in.in).toEqual(schema);
      expect(mappedSchema.out.shape).toHaveProperty(
        "userId",
        expect.any(z.ZodString),
      );
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
        expect(mappedSchema._zod.def.out.shape).toHaveProperty(
          "userId",
          expect.any(z.ZodString),
        );
        expect(mappedSchema._zod.def.out.shape).toHaveProperty(
          "name",
          expect.any(z.ZodString),
        );
        expect(mappedSchema.parse({ user_id: "test", name: "some" })).toEqual({
          userId: "test",
          name: "some",
        });
      },
    );

    test("should support a mapping function", () => {
      const schema = z.object({ user_id: z.string(), name: z.string() });
      const mappedSchema = schema.remap((shape) => camelize(shape, true));
      expect(mappedSchema._zod.def.out.shape).toHaveProperty(
        "userId",
        expect.any(z.ZodString),
      );
      expect(mappedSchema._zod.def.out.shape).toHaveProperty(
        "name",
        expect.any(z.ZodString),
      );
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
