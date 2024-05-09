import { combinations, isObject } from "./common-helpers";
import { z } from "zod";
import { clone, mergeDeepRight } from "ramda";

export const metaSymbol = Symbol.for("express-zod-api");

export interface Metadata<T extends z.ZodTypeAny> {
  examples: z.input<T>[];
  /** @override ZodDefault::_def.defaultValue() in depictDefault */
  defaultLabel?: string;
  brand?: string | number | symbol;
}

export const hasMeta = <T extends z.ZodTypeAny>(schema: T) =>
  metaSymbol in schema._def && isObject(schema._def[metaSymbol]);

declare module "zod" {
  interface ZodTypeDef {
    [metaSymbol]?: Metadata<z.ZodTypeAny>;
  }
  interface ZodType {
    /** @desc Add an example value (before any transformations, can be called multiple times) */
    example(example: this["_input"]): this;
    /** @desc Returns the previously assigned examples */
    getExamples(): z.input<this>[] | undefined;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ZodDefault<T extends z.ZodTypeAny> {
    /** @desc Change the default value in the generated Documentation to a label */
    label(label: string): this;
    /** @desc Returns the previously assigned label */
    getLabel(): string | undefined;
  }
  interface ZodBranded<
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    T extends z.ZodTypeAny,
    B extends string | number | symbol,
  > {
    /** @desc Returns the brand */
    getBrand(): B | undefined;
  }
}

/** @link https://github.com/colinhacks/zod/blob/3e4f71e857e75da722bd7e735b6d657a70682df2/src/types.ts#L485 */
const cloneSchema = <T extends z.ZodType>(schema: T) => {
  const copy = schema.describe(schema.description as string);
  copy._def[metaSymbol] = // clone for deep copy, issue #827
    clone(copy._def[metaSymbol]) || ({ examples: [] } satisfies Metadata<T>);
  return copy;
};

const exampleSetter = function (
  this: z.ZodType,
  value: (typeof this)["_input"],
) {
  const copy = cloneSchema(this);
  copy._def[metaSymbol]!.examples.push(value);
  return copy;
};

const examplesGetter = function (this: z.ZodType) {
  return hasMeta(this) ? this._def[metaSymbol]!.examples : undefined;
};

const labelSetter = function (this: z.ZodDefault<z.ZodTypeAny>, label: string) {
  const copy = cloneSchema(this);
  copy._def[metaSymbol]!.defaultLabel = label;
  return copy;
};

const labelGetter = function (this: z.ZodDefault<z.ZodTypeAny>) {
  return hasMeta(this) ? this._def[metaSymbol]!.defaultLabel : undefined;
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

const brandGetter = function (this: z.ZodBranded<z.ZodTypeAny, any>) {
  return hasMeta(this) ? this._def[metaSymbol]!.brand : undefined;
};

/** @see https://github.com/colinhacks/zod/blob/90efe7fa6135119224412c7081bd12ef0bccef26/plugin/effect/src/index.ts#L21-L31 */
if (!(metaSymbol in globalThis)) {
  (globalThis as Record<symbol, unknown>)[metaSymbol] = true;
  Object.defineProperty(
    z.ZodType.prototype,
    "example" satisfies keyof z.ZodType,
    {
      get(): z.ZodType["example"] {
        return exampleSetter.bind(this);
      },
    },
  );
  Object.defineProperty(
    z.ZodType.prototype,
    "getExamples" satisfies keyof z.ZodType,
    {
      get(): z.ZodType["getExamples"] {
        return examplesGetter.bind(this);
      },
    },
  );
  Object.defineProperty(
    z.ZodType.prototype,
    "brand" satisfies keyof z.ZodType,
    {
      set() {}, // this is required to override the existing method
      get() {
        return brandSetter.bind(this) as z.ZodType["brand"];
      },
    },
  );
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
    z.ZodDefault.prototype,
    "getLabel" satisfies keyof z.ZodDefault<z.ZodTypeAny>,
    {
      get(): z.ZodDefault<z.ZodTypeAny>["getLabel"] {
        return labelGetter.bind(this);
      },
    },
  );
  Object.defineProperty(
    z.ZodBranded.prototype,
    "getBrand" satisfies keyof z.ZodBranded<z.ZodTypeAny, any>,
    {
      get(): z.ZodBranded<z.ZodTypeAny, any>["getBrand"] {
        return brandGetter.bind(this);
      },
    },
  );
}

export const copyMeta = <A extends z.ZodTypeAny, B extends z.ZodTypeAny>(
  src: A,
  dest: B,
): B => {
  if (!hasMeta(src)) {
    return dest;
  }
  const result = cloneSchema(dest);
  result._def[metaSymbol].examples = combinations(
    result._def[metaSymbol].examples,
    src._def[metaSymbol].examples,
    ([destExample, srcExample]) =>
      typeof destExample === "object" && typeof srcExample === "object"
        ? mergeDeepRight({ ...destExample }, { ...srcExample })
        : srcExample, // not supposed to be called on non-object schemas
  );
  return result;
};
