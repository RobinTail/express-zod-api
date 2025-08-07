import * as R from "ramda";
import { globalRegistry, z } from "zod";
import { $EZBrandCheck } from "./brand-check";
import { name } from "./package.json";

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

const brandSetter = function (
  this: z.ZodType,
  brand?: string | number | symbol,
) {
  return this.check(new $EZBrandCheck({ brand, check: "$EZBrandCheck" }));
};

type _Mapper = <T extends Record<string, unknown>>(
  subject: T,
) => { [P in string | keyof T]: T[keyof T] };

const objectMapper = function (
  this: z.ZodObject,
  tool: Record<string, string> | _Mapper,
) {
  const transformer =
    typeof tool === "function" ? tool : R.renameKeys(R.reject(R.isNil, tool)); // rejecting undefined
  const nextShape = transformer(
    R.map(R.invoker(0, "clone"), this._zod.def.shape), // immutable, changed from R.clone due to failure
  );
  const hasPassThrough = this._zod.def.catchall instanceof z.ZodUnknown;
  const output = (hasPassThrough ? z.looseObject : z.object)(nextShape); // proxies unknown keys when set to "passthrough"
  return this.transform(transformer).pipe(output);
};

const pluginFlag = Symbol.for(name);

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
          return brandSetter.bind(this) as z.ZodType["brand"];
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
    { value: objectMapper, writable: false },
  );
}
