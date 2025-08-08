import type { z } from "zod";
import { unpack } from "./packer";

export const getBrand = (subject: z.core.$ZodType) => {
  const { brand } = unpack(subject) || {};
  if (
    typeof brand === "symbol" ||
    typeof brand === "string" ||
    typeof brand === "number"
  )
    return brand;
  return undefined;
};
