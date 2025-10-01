import { globalRegistry, z } from "zod";
import { setBrand } from "./brand.ts";
import { remap } from "./remap.ts";

const exampleSetter = function (this: z.ZodType, value: z.output<typeof this>) {
  const examples = globalRegistry.get(this)?.examples?.slice() || [];
  examples.push(value);
  return this.meta({ examples });
};

const deprecationSetter = function (this: z.ZodType) {
  return this.meta({ deprecated: true });
};

const labelSetter = function (this: z.ZodDefault, defaultLabel: string) {
  return this.meta({ default: defaultLabel });
};

// eslint-disable-next-line no-restricted-syntax -- substituted by TSDOWN
const pluginFlag = Symbol.for(process.env.TSDOWN_SELF!);

if (!(pluginFlag in globalThis)) {
  (globalThis as Record<symbol, unknown>)[pluginFlag] = true;
  for (const entry of Object.keys(z)) {
    if (!entry.startsWith("Zod")) continue;
    if (/(Success|Error|Function)$/.test(entry)) continue;
    const Cls = z[entry as keyof typeof z];
    if (typeof Cls !== "function") continue;
    Object.defineProperties(Cls.prototype, {
      ["example" satisfies keyof z.ZodType]: {
        value: exampleSetter,
        writable: false,
      },
      ["deprecated" satisfies keyof z.ZodType]: {
        value: deprecationSetter,
        writable: false,
      },
      ["brand" satisfies keyof z.ZodType]: {
        set() {}, // this is required to override the existing method
        get() {
          return setBrand.bind(this) as z.ZodType["brand"];
        },
      },
    });
  }

  Object.defineProperty(
    z.ZodDefault.prototype,
    "label" satisfies keyof z.ZodDefault,
    { value: labelSetter, writable: false },
  );
  Object.defineProperty(
    z.ZodObject.prototype,
    "remap" satisfies keyof z.ZodObject,
    { value: remap, writable: false },
  );
}
