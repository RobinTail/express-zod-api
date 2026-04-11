import { z } from "zod";
import { brandProperty } from "./metadata";

export const ezFormBrand = Symbol("Form");

/** @desc Accepts an object shape or a custom object schema */
export const form = <S extends z.core.$ZodShape>(base: S | z.ZodObject<S>) =>
  (base instanceof z.ZodObject ? base : z.object(base)).meta({
    [brandProperty]: ezFormBrand,
  });
