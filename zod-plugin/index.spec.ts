import { z } from "zod";

describe("Entrypoint", () => {
  test("Extended Zod prototypes", () => {
    expectTypeOf<z.ZodAny>()
      .toHaveProperty("example")
      .toExtend<(value: any) => z.ZodAny>();
    expectTypeOf<z.ZodDefault<z.ZodString>>()
      .toHaveProperty("example")
      .toExtend<(value: string) => z.ZodDefault<z.ZodString>>();
    expectTypeOf<z.ZodDefault<z.ZodString>>()
      .toHaveProperty("label")
      .toExtend<(value: string) => z.ZodDefault<z.ZodString>>();
    expectTypeOf<z.ZodObject>().toHaveProperty("remap");
  });
});
