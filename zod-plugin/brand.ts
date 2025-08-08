import type { z } from "zod";
import { unpack } from "./packer";

/** The property within schema._zod.bag where we store the brand */
export const brandProperty = "brand";

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
