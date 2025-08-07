import * as R from "ramda";
import { globalRegistry, z } from "zod";
import { $EZBrandCheck } from "./brand-check";
import { name } from "./package.json";
import { Intact, Remap } from "./remap";

declare module "zod/v4/core" {
  interface GlobalMeta {
    default?: unknown; // can be an actual value or a label like "Today"
    examples?: unknown[]; // see zod commit ee5615d
  }
}

/**
 * @fileoverview Zod Runtime Plugin
 * @see https://github.com/colinhacks/zod/blob/90efe7fa6135119224412c7081bd12ef0bccef26/plugin/effect/src/index.ts#L21-L31
 * @desc This code modifies and extends zod's functionality immediately when importing the plugin.
 * @desc Enables .example() and .deprecated() on all schemas (ZodType)
 * @desc Enables .label() on ZodDefault
 * @desc Enables .remap() on ZodObject
 * @desc Stores the argument supplied to .brand() on all schemas (runtime distinguishable branded types)
 * */
declare module "zod" {
  interface ZodType<
    out Output = unknown,
    out Input = unknown,
    out Internals extends z.core.$ZodTypeInternals<
      Output,
      Input
    > = z.core.$ZodTypeInternals<Output, Input>,
  > extends z.core.$ZodType<Output, Input, Internals> {
    /** @desc Shorthand for .meta({ examples }) */
    example(example: z.output<this>): this;
    deprecated(): this;
  }
  interface ZodDefault<T extends z.core.SomeType = z.core.$ZodType>
    extends z._ZodType<z.core.$ZodDefaultInternals<T>>,
      z.core.$ZodDefault<T> {
    /** @desc Shorthand for .meta({ default }) */
    label(label: string): this;
  }
  interface ZodObject<
    // @ts-expect-error -- external issue
    out Shape extends z.core.$ZodShape = z.core.$ZodLooseShape,
    out Config extends z.core.$ZodObjectConfig = z.core.$strip,
  > extends z._ZodType<z.core.$ZodObjectInternals<Shape, Config>>,
      z.core.$ZodObject<Shape, Config> {
    remap<V extends string, U extends { [P in keyof Shape]?: V }>(
      mapping: U,
    ): z.ZodPipe<
      z.ZodPipe<this, z.ZodTransform>, // internal type simplified
      z.ZodObject<Remap<Shape, U, V> & Intact<Shape, U>, Config>
    >;
    remap<U extends z.core.$ZodShape>(
      mapper: (subject: Shape) => U,
    ): z.ZodPipe<z.ZodPipe<this, z.ZodTransform>, z.ZodObject<U>>; // internal type simplified
  }
}

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
