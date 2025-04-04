import { z } from "zod";

export const ezFormBrand = Symbol("Form");

/** @desc Accepts an object shape or a custom object schema */
export const form = <S extends z.ZodRawShape>(base: S | z.ZodObject<S>) =>
  (base instanceof z.ZodObject ? base : z.object(base)).brand(
    ezFormBrand as symbol,
  );

export type FormSchema = ReturnType<typeof form>;
