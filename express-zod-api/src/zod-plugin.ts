/**
 * @fileoverview Zod Runtime Plugin
 * @see https://github.com/colinhacks/zod/blob/90efe7fa6135119224412c7081bd12ef0bccef26/plugin/effect/src/index.ts#L21-L31
 * @desc This code modifies and extends zod's functionality immediately when importing express-zod-api
 * @desc Enables .example() and .deprecated() on all schemas (ZodType)
 * @desc Enables .label() on ZodDefault
 * @desc Enables .remap() on ZodObject
 * @desc Stores the argument supplied to .brand() on all schema (runtime distinguishable branded types)
 * @desc Ensures that the brand withstands additional refinements or checks
 * */
import * as R from "ramda";
import { z, globalRegistry } from "zod/v4";
import { FlatObject } from "./common-helpers";
import { Metadata, metaSymbol } from "./metadata";
import { Intact, Remap } from "./mapping-helpers";
import type {
  $ZodType,
  $ZodShape,
  $ZodLooseShape,
  $ZodObjectConfig,
} from "zod/v4/core";

declare module "zod/v4/core" {
  interface GlobalMeta {
    [metaSymbol]?: Metadata;
    deprecated?: boolean;
  }
}

declare module "zod/v4" {
  interface ZodType {
    /** @desc Add an example value (before any transformations, can be called multiple times) */
    example(example: z.input<this>): this;
    deprecated(): this;
  }
  interface ZodDefault<T extends $ZodType = $ZodType> extends ZodType {
    /** @desc Change the default value in the generated Documentation to a label */
    label(label: string): this;
  }
  interface ZodObject<
    // @ts-expect-error -- external issue
    out Shape extends $ZodShape = $ZodLooseShape,
    out Config extends $ZodObjectConfig = $ZodObjectConfig,
  > extends ZodType {
    remap<V extends string, U extends { [P in keyof Shape]?: V }>(
      mapping: U,
    ): z.ZodPipe<
      z.ZodPipe<
        this,
        z.ZodTransform<FlatObject, FlatObject> // internal type simplified
      >,
      z.ZodObject<Remap<Shape, U, V> & Intact<Shape, U>, Config>
    >;
    remap<U extends $ZodShape>(
      mapper: (subject: Shape) => U,
    ): z.ZodPipe<
      z.ZodPipe<this, z.ZodTransform<FlatObject, FlatObject>>, // internal type simplified
      z.ZodObject<U>
    >;
  }
}

const exampleSetter = function (this: z.ZodType, value: z.input<typeof this>) {
  const { [metaSymbol]: internal, ...rest } = this.meta() || {};
  const copy = internal?.examples.slice() || [];
  copy.push(value);
  return this.meta({
    ...rest,
    [metaSymbol]: { ...internal, examples: copy },
  });
};

const deprecationSetter = function (this: z.ZodType) {
  return this.meta({
    ...this.meta(),
    deprecated: true,
  });
};

const labelSetter = function (this: z.ZodDefault, defaultLabel: string) {
  const { [metaSymbol]: internal = { examples: [] }, ...rest } =
    this.meta() || {};
  return this.meta({
    ...rest,
    [metaSymbol]: { ...internal, defaultLabel },
  });
};

const brandSetter = function (
  this: z.ZodType,
  brand?: string | number | symbol,
) {
  const { [metaSymbol]: internal = { examples: [] }, ...rest } =
    this.meta() || {};
  return this.meta({
    ...rest, // @todo this may no longer be required since it seems that .meta() merges now, not just overrides
    [metaSymbol]: { ...internal, brand },
  });
};

const objectMapper = function (
  this: z.ZodObject,
  tool:
    | Record<string, string>
    | (<T>(subject: T) => { [P in string | keyof T]: T[keyof T] }),
) {
  const transformer =
    typeof tool === "function"
      ? tool
      : R.pipe(
          R.toPairs, // eslint-disable-line no-restricted-syntax -- strict key type required
          R.map(([key, value]) => R.pair(tool[String(key)] || key, value)),
          R.fromPairs,
        );
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
    let originalCheck: z.ZodType["check"];
    Object.defineProperties(Cls.prototype, {
      ["example" satisfies keyof z.ZodType]: {
        get(): z.ZodType["example"] {
          return exampleSetter.bind(this);
        },
      },
      ["deprecated" satisfies keyof z.ZodType]: {
        get(): z.ZodType["deprecated"] {
          return deprecationSetter.bind(this);
        },
      },
      ["brand" satisfies keyof z.ZodType]: {
        set() {}, // this is required to override the existing method
        get() {
          return brandSetter.bind(this) as z.ZodType["brand"];
        },
      },
      ["check" satisfies keyof z.ZodType]: {
        set(fn) {
          originalCheck = fn;
        },
        get(): z.ZodType["check"] {
          return function (
            this: z.ZodType,
            ...args: Parameters<z.ZodType["check"]>
          ) {
            /** @link https://v4.zod.dev/metadata#register */
            return originalCheck.apply(this, args).register(globalRegistry, {
              [metaSymbol]: {
                examples: [],
                brand: this.meta()?.[metaSymbol]?.brand,
              },
            });
          };
        },
      },
    });
  }

  Object.defineProperty(
    z.ZodDefault.prototype,
    "label" satisfies keyof z.ZodDefault,
    {
      get(): z.ZodDefault["label"] {
        return labelSetter.bind(this);
      },
    },
  );
  Object.defineProperty(
    z.ZodObject.prototype,
    "remap" satisfies keyof z.ZodObject,
    {
      get() {
        return objectMapper.bind(this);
      },
    },
  );
}
