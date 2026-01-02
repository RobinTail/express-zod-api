import { z, globalRegistry } from "zod";

/** The property we store the brand in */
export const brandProperty = "x-brand" as const;

/** Used by runtime (bound) */
export const setBrand = function (this: z.ZodType, brand?: PropertyKey) {
  return this.meta({ [brandProperty]: brand });
};

/**
 * @public
 * @desc Retrieves the brand from the schema set by its .brand() method.
 * */
export const getBrand = (subject: z.core.$ZodType) => {
  const { [brandProperty]: brand } = globalRegistry.get(subject) || {};
  if (
    typeof brand === "symbol" ||
    typeof brand === "string" ||
    typeof brand === "number"
  )
    return brand;
  return undefined;
};
