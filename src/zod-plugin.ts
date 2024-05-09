/**
 * @fileoverview Zod Runtime Plugin
 * @see https://github.com/colinhacks/zod/blob/90efe7fa6135119224412c7081bd12ef0bccef26/plugin/effect/src/index.ts#L21-L31
 * @desc This code modifies and extends zod's functionality immediately when importing express-zod-api
 * @desc Enables .examples() on all schemas (ZodType)
 * @desc Enables .label() on ZodDefault
 * @desc Stores the argument supplied to .brand() on all schema (runtime distinguishable branded types)
 * */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { clone } from "ramda";
import { z } from "zod";
import { Metadata, cloneSchema, hasMeta, metaSymbol } from "./metadata";

declare module "zod" {
  interface ZodTypeDef {
    [metaSymbol]?: Metadata<z.ZodTypeAny>;
  }
  interface ZodType {
    /** @desc Add an example value (before any transformations, can be called multiple times) */
    example(example: this["_input"]): this;
  }
  interface ZodDefault<T extends z.ZodTypeAny> {
    /** @desc Change the default value in the generated Documentation to a label */
    label(label: string): this;
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
}
