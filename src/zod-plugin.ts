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
