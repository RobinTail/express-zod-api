import { z } from "zod";

export const ezFormBrand = Symbol("Form");

export const form = <S extends z.ZodRawShape>(shape: S) =>
  z.object(shape).brand(ezFormBrand as symbol);

export type FormSchema = ReturnType<typeof form>;
