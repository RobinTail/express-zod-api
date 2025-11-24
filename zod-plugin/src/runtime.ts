import { globalRegistry, z } from "zod";
import { setBrand } from "./brand";
import { remap } from "./remap";
import { createRequire } from "node:module";

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
  const packages = [z];
  const { z: zCJS } = createRequire(import.meta.url)("zod") as { z: typeof z };
  if (z !== zCJS) packages.push(zCJS);
  for (const pkg of packages) {
    for (const entry of Object.keys(pkg)) {
      if (!entry.startsWith("Zod")) continue;
      if (/(Success|Error|Function)$/.test(entry)) continue;
      const Cls = pkg[entry as keyof typeof pkg];
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
      pkg.ZodDefault.prototype,
      "label" satisfies keyof z.ZodDefault,
      { value: labelSetter, writable: false },
    );
    Object.defineProperty(
      pkg.ZodObject.prototype,
      "remap" satisfies keyof z.ZodObject,
      { value: remap, writable: false },
    );
  }
}
