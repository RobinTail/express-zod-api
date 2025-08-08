import { z } from "zod";
import * as entrypoint from "./index";

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
  });

  test("Exports", () => {
    expect(entrypoint).toMatchObject({
      getBrand: expect.any(Function),
      pack: expect.any(Function),
      unpack: expect.any(Function),
    });
  });
});
