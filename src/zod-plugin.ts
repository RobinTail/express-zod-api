/**
 * @fileoverview Zod Runtime Plugin
 * @see https://github.com/colinhacks/zod/blob/90efe7fa6135119224412c7081bd12ef0bccef26/plugin/effect/src/index.ts#L21-L31
 * @desc This code modifies and extends zod's functionality immediately when importing express-zod-api
 * @desc Enables .examples() on all schemas (ZodType)
 * @desc Enables .label() on ZodDefault
 * @desc Stores the argument supplied to .brand() on all schema (runtime distinguishable branded types)
 * */
import { clone, fromPairs, map, pipe, toPairs } from "ramda";
import { z } from "zod";
import { Metadata, cloneSchema, metaSymbol } from "./metadata";

// @link https://stackoverflow.com/questions/55454125/typescript-remapping-object-properties-in-typesafe
type TuplesFromObject<T> = {
  [P in keyof T]: [P, T[P]];
}[keyof T];
type GetKeyByValue<T, V> =
  TuplesFromObject<T> extends infer TT
    ? TT extends [infer P, V]
      ? P
      : never
    : never;
type Remap<T, U extends { [P in keyof T]: V }, V extends string> = {
  [P in U[keyof U]]: T[GetKeyByValue<U, P>];
};

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
    remap<V extends string, U extends { [P in keyof T]: V }>(
      mapping: U,
    ): z.ZodPipeline<
      z.ZodEffects<
        this,
        Remap<z.output<z.ZodObject<T, UnknownKeys, Catchall>>, U, V>
      >,
      z.ZodObject<Remap<T, U, V>>
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
      map<[string, unknown], [string, unknown]>(([key, value]) => [
        mapping[key],
        value,
      ]),
      fromPairs,
    ),
  ).pipe(
    z.object(
      pipe(
        toPairs,
        map<[string, z.ZodTypeAny], [string, z.ZodTypeAny]>(([key, schema]) => [
          mapping[key],
          schema,
        ]),
        fromPairs,
      )(this.shape),
    ),
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
