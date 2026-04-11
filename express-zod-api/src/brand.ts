import type { brandProperty as brandProp } from "../../zod-plugin/src/brand.ts";
import { globalRegistry, type z } from "zod";

export const brandProperty = "x-brand" satisfies typeof brandProp;

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
