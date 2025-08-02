import type { z } from "zod";

export const metaSymbol = Symbol.for("express-zod-api");

export const getBrand = (subject: z.core.$ZodType) => {
  const { brand } = subject._zod.bag || {};
  if (
    typeof brand === "symbol" ||
    typeof brand === "string" ||
    typeof brand === "number"
  )
    return brand;
  return undefined;
};
