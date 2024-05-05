import { z } from "zod";
import { isValidDate } from "./schema-helpers";

export const ezDateOutKind = Symbol.for("DateOut");

export const dateOut = () =>
  z
    .date()
    .refine(isValidDate)
    .transform((date) => date.toISOString())
    .brand(ezDateOutKind);
