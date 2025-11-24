import type { z } from "zod";
import { setBrand } from "./brand";
import { remap } from "./remap";
import { deprecationSetter, exampleSetter, labelSetter } from "./meta";
import { getZodPackages } from "./packages";

// eslint-disable-next-line no-restricted-syntax -- substituted by TSDOWN
const pluginFlag = Symbol.for(process.env.TSDOWN_SELF!);

if (!(pluginFlag in globalThis)) {
  (globalThis as Record<symbol, unknown>)[pluginFlag] = true;
  for (const pkg of getZodPackages()) {
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
