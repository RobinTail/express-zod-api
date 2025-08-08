import { z } from "zod";
import { pack, unpack } from "./packer";

/** The property within schema._zod.bag where we store the brand */
export const brandProperty = "brand" as const;

/** Used by runtime (bound) */
export const setBrand = function (this: z.ZodType, brand?: PropertyKey) {
  return pack(this, { [brandProperty]: brand });
};

export const getBrand = (subject: z.core.$ZodType) => {
  const { [brandProperty]: brand } = unpack(subject) || {};
  if (
    typeof brand === "symbol" ||
    typeof brand === "string" ||
    typeof brand === "number"
  )
    return brand;
  return undefined;
};
