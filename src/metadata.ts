import { combinations, isObject } from "./common-helpers";
import { z } from "zod";
import { clone, mergeDeepRight } from "ramda";
import { ProprietaryKind } from "./proprietary-schemas";

export const metaSymbol = Symbol.for("express-zod-api");

export interface Metadata<T extends z.ZodTypeAny> {
  kind?: ProprietaryKind;
  examples: z.input<T>[];
}

declare module "zod" {
  interface ZodTypeDef {
    [metaSymbol]?: Metadata<z.ZodTypeAny>;
  }
  interface ZodType {
    example(example: this["_input"]): this;
  }
}

/** @link https://github.com/colinhacks/zod/blob/3e4f71e857e75da722bd7e735b6d657a70682df2/src/types.ts#L485 */
const cloneSchema = (schema: z.ZodType) => {
  const copy = schema.describe(schema.description as string);
  copy._def[metaSymbol] = // clone for deep copy, issue #827
    clone(copy._def[metaSymbol]) ||
    ({ examples: [] } satisfies Metadata<typeof copy>);
  return copy as z.ZodType<
    typeof copy._output,
    Required<Pick<typeof copy._def, typeof metaSymbol>>,
    typeof copy._input
  >;
};

const exampleSetter = function (
  this: z.ZodType,
  value: (typeof this)["_input"],
) {
  const copy = cloneSchema(this);
  copy._def[metaSymbol].examples.push(value);
  return copy;
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
}

export const hasMeta = <T extends z.ZodTypeAny>(schema: T) =>
  metaSymbol in schema._def && isObject(schema._def[metaSymbol]);

export const getMeta = <T extends z.ZodTypeAny, K extends keyof Metadata<T>>(
  schema: T,
  meta: K,
): Readonly<Metadata<T>[K]> | undefined =>
  hasMeta(schema) ? schema._def[metaSymbol][meta] : undefined;

export const copyMeta = <A extends z.ZodTypeAny, B extends z.ZodTypeAny>(
  src: A,
  dest: B,
) => {
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
  return result as B;
};

export const proprietary = <T extends z.ZodTypeAny>(
  kind: ProprietaryKind,
  subject: T,
) => {
  const schema = cloneSchema(subject);
  schema._def[metaSymbol].kind = kind;
  return schema as T;
};

export const isProprietary = (schema: z.ZodTypeAny, kind: ProprietaryKind) =>
  getMeta(schema, "kind") === kind;

/**
 * @deprecated no longer required
 * @todo remove in v19
 * */
export const withMeta = <T extends z.ZodTypeAny>(schema: T) => schema;
