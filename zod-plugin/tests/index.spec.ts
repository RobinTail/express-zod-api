import { globalRegistry, z } from "zod";
import * as entrypoint from "../src";

describe("Entrypoint", () => {
  test("Augmentation", () => {
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
    expectTypeOf<ReturnType<typeof globalRegistry.get>>()
      .exclude(undefined)
      .toHaveProperty("default")
      .toEqualTypeOf<unknown | undefined>();
    expectTypeOf<ReturnType<typeof globalRegistry.get>>()
      .exclude(undefined)
      .toHaveProperty("examples")
      .toEqualTypeOf<unknown[] | undefined>();
    expectTypeOf<ReturnType<typeof globalRegistry.get>>()
      .exclude(undefined)
      .toHaveProperty("x-brand")
      .toEqualTypeOf<symbol | string | number | undefined>();
  });

  test("has no exports", () => {
    expect(Object.keys(entrypoint)).toHaveLength(0);
  });
});
