/**
 * @fileoverview Zod Runtime Plugin
 * @see https://github.com/colinhacks/zod/blob/90efe7fa6135119224412c7081bd12ef0bccef26/plugin/effect/src/index.ts#L21-L31
 * @desc This code modifies and extends zod's functionality immediately when importing express-zod-api
 * @desc Enables .example() and .deprecated() on all schemas (ZodType)
 * @desc Enables .label() on ZodDefault
 * @desc Enables .remap() on ZodObject
 * @desc Stores the argument supplied to .brand() on all schema (runtime distinguishable branded types)
 * */
import * as R from "ramda";
import { z } from "zod/v4";
import { getExamples, metaSymbol } from "./metadata";
import { Intact, Remap } from "./mapping-helpers";
import type {
  $ZodType,
  $ZodShape,
  $ZodLooseShape,
  $ZodObjectConfig,
  $ZodCheck,
  $ZodCheckInternals,
  $ZodCheckDef,
  SomeType,
  $ZodDefaultInternals,
  $ZodDefault,
  $ZodObjectInternals,
  $ZodObject,
  $ZodTypeInternals,
  $strip,
} from "zod/v4/core";

declare module "zod/v4/core" {
  interface GlobalMeta {
    default?: unknown; // can be an actual value or a label like "Today"
    examples?:
      | unknown[] // see zod commit ee5615d
      | Record<string, { value: unknown; [k: string]: unknown }>; // @todo remove in v25
    /** @deprecated use examples instead */
    example?: unknown; // see zod commit ee5615d @todo remove in v25
  }
}

declare module "zod/v4" {
  interface ZodType<
    out Output = unknown,
    out Input = unknown,
    out Internals extends $ZodTypeInternals<Output, Input> = $ZodTypeInternals<
      Output,
      Input
    >,
  > extends $ZodType<Output, Input, Internals> {
    /** @desc Alias for .meta({examples}), but argument is typed to ensure the correct placement for transformations */
    example(example: z.output<this>): this;
    deprecated(): this;
  }
  interface ZodDefault<T extends SomeType = $ZodType>
    extends z._ZodType<$ZodDefaultInternals<T>>,
      $ZodDefault<T> {
    /** @desc Change the default value in the generated Documentation to a label, alias for .meta({ default }) */
    label(label: string): this;
  }
  interface ZodObject<
    // @ts-expect-error -- external issue
    out Shape extends $ZodShape = $ZodLooseShape,
    out Config extends $ZodObjectConfig = $strip,
  > extends z._ZodType<$ZodObjectInternals<Shape, Config>>,
      $ZodObject<Shape, Config> {
    remap<V extends string, U extends { [P in keyof Shape]?: V }>(
      mapping: U,
    ): z.ZodPipe<
      z.ZodPipe<this, z.ZodTransform>, // internal type simplified
      z.ZodObject<Remap<Shape, U, V> & Intact<Shape, U>, Config>
    >;
    remap<U extends $ZodShape>(
      mapper: (subject: Shape) => U,
    ): z.ZodPipe<z.ZodPipe<this, z.ZodTransform>, z.ZodObject<U>>; // internal type simplified
  }
}

interface $EZBrandCheckDef extends $ZodCheckDef {
  check: "$EZBrandCheck";
  brand?: string | number | symbol;
}

interface $EZBrandCheckInternals extends $ZodCheckInternals<unknown> {
  def: $EZBrandCheckDef;
}

interface $EZBrandCheck extends $ZodCheck {
  _zod: $EZBrandCheckInternals;
}

/**
 * This approach was suggested to me by Colin in a PM on Twitter.
 * Refrained from storing the brand in Metadata because it should withstand refinements.
 * */
const $EZBrandCheck = z.core.$constructor<$EZBrandCheck>(
  "$EZBrandCheck",
  (inst, def) => {
    z.core.$ZodCheck.init(inst, def);
    inst._zod.onattach.push((schema) => (schema._zod.bag.brand = def.brand));
    inst._zod.check = () => {};
  },
);

const exampleSetter = function (this: z.ZodType, value: z.output<typeof this>) {
  const examples = getExamples(this).slice();
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

if (!(metaSymbol in globalThis)) {
  (globalThis as Record<symbol, unknown>)[metaSymbol] = true;
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
