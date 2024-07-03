/**
 * @fileoverview Zod Runtime Plugin
 * @see https://github.com/colinhacks/zod/blob/90efe7fa6135119224412c7081bd12ef0bccef26/plugin/effect/src/index.ts#L21-L31
 * @desc This code modifies and extends zod's functionality immediately when importing express-zod-api
 * @desc Enables .examples() on all schemas (ZodType)
 * @desc Enables .label() on ZodDefault
 * @desc Stores the argument supplied to .brand() on all schema (runtime distinguishable branded types)
 * */
import { clone, fromPairs, map, pipe, toPairs, pair } from "ramda";
import { z } from "zod";
import { FlatObject } from "./common-helpers";
import { cloneSchema, Metadata, metaSymbol } from "./metadata";
import { Intact, Remap } from "./mapping-helpers";

declare module "zod" {
  interface ZodTypeDef {
    [metaSymbol]?: Metadata;
  }
  interface ZodType {
    /** @desc Add an example value (before any transformations, can be called multiple times) */
    example(example: this["_input"]): this;
  }
  interface ZodDefault<T extends z.ZodTypeAny> {
    /** @desc Change the default value in the generated Documentation to a label */
    label(label: string): this;
  }
  interface ZodObject<
    T extends z.ZodRawShape,
    UnknownKeys extends z.UnknownKeysParam = z.UnknownKeysParam,
    Catchall extends z.ZodTypeAny = z.ZodTypeAny,
    Output = z.objectOutputType<T, Catchall, UnknownKeys>,
    Input = z.objectInputType<T, Catchall, UnknownKeys>,
  > {
    remap<V extends string, U extends { [P in keyof T]?: V }>(
      mapping: U,
    ): z.ZodPipeline<
      z.ZodEffects<this, FlatObject>, // internal type simplified
      z.ZodObject<Remap<T, U, V> & Intact<T, U>>
    >;
  }
}

const exampleSetter = function (
  this: z.ZodType,
  value: (typeof this)["_input"],
) {
  const copy = cloneSchema(this);
  copy._def[metaSymbol]!.examples.push(value);
  return copy;
};

const labelSetter = function (this: z.ZodDefault<z.ZodTypeAny>, label: string) {
  const copy = cloneSchema(this);
  copy._def[metaSymbol]!.defaultLabel = label;
  return copy;
};

const brandSetter = function (
  this: z.ZodType,
  brand?: string | number | symbol,
) {
  return new z.ZodBranded({
    typeName: z.ZodFirstPartyTypeKind.ZodBranded,
    type: this,
    description: this._def.description,
    errorMap: this._def.errorMap,
    [metaSymbol]: { examples: [], ...clone(this._def[metaSymbol]), brand },
  });
};

const objectMapper = function (
  this: z.ZodObject<z.ZodRawShape>,
  mapping: Record<string, string>,
) {
  return this.transform(
    pipe(
      toPairs,
      map(([key, value]) => pair(mapping[key] || key, value)),
      fromPairs,
    ),
  ).pipe(
    z
      .object(
        pipe(
          toPairs,
          map(([key, schema]) => pair(mapping[String(key)] || key, schema)),
          fromPairs,
        )(clone(this.shape)), // immutable, no references to the original schemas
      )
      [this._def.unknownKeys](), // proxies unknown keys when set to "passthrough"
  );
};

if (!(metaSymbol in globalThis)) {
  (globalThis as Record<symbol, unknown>)[metaSymbol] = true;
  Object.defineProperties(z.ZodType.prototype, {
    ["example" satisfies keyof z.ZodType]: {
      get(): z.ZodType["example"] {
        return exampleSetter.bind(this);
      },
    },
    ["brand" satisfies keyof z.ZodType]: {
      set() {}, // this is required to override the existing method
      get() {
        return brandSetter.bind(this) as z.ZodType["brand"];
      },
    },
  });
  Object.defineProperty(
    z.ZodDefault.prototype,
    "label" satisfies keyof z.ZodDefault<z.ZodTypeAny>,
    {
      get(): z.ZodDefault<z.ZodTypeAny>["label"] {
        return labelSetter.bind(this);
      },
    },
  );
  Object.defineProperty(
    z.ZodObject.prototype,
    "remap" satisfies keyof z.ZodObject<z.ZodRawShape>,
    {
      get() {
        return objectMapper.bind(this) as z.ZodObject<z.ZodRawShape>["remap"];
      },
    },
  );
}
