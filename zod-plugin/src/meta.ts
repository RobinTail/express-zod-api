import { globalRegistry, type z } from "zod";

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
