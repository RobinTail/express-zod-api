import type { $ZodType } from "zod/v4/core";

export const metaSymbol = Symbol.for("express-zod-api");

export const getBrand = (subject: $ZodType) => {
  const { brand } = subject._zod.bag || {};
  if (
    typeof brand === "symbol" ||
    typeof brand === "string" ||
    typeof brand === "number"
  )
    return brand;
  return undefined;
};
