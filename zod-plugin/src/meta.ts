import { globalRegistry, type z } from "zod";
import { brandProperty } from "./brand";

export const exampleSetter = function (
  this: z.ZodType,
  value: z.output<typeof this>,
) {
  const examples = globalRegistry.get(this)?.examples?.slice() || [];
  examples.push(value);
  return this.meta({ examples });
};

export const deprecationSetter = function (this: z.ZodType) {
  return this.meta({ deprecated: true });
};

export const labelSetter = function (this: z.ZodDefault, defaultLabel: string) {
  return this.meta({ default: defaultLabel });
};

export const brandSetter = function (this: z.ZodType, brand?: PropertyKey) {
  return this.meta({ [brandProperty]: brand });
};
