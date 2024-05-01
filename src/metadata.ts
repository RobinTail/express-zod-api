import { combinations, isObject } from "./common-helpers";
import { z } from "zod";
import { clone, mergeDeepRight } from "ramda";
import { ProprietaryKind } from "./proprietary-schemas";

// @see https://github.com/colinhacks/zod/pull/3445/files#diff-d8a41ab20c64f92092513f153b78e7bbf5dc929c92909fad25e03d53c7f15bb7R21-R37
export const metaSymbol = Symbol.for("express-zod-api");

export interface Metadata {
  /**
   * @todo if the following PR merged, use native branding instead:
   * @link https://github.com/colinhacks/zod/pull/2860
   * */
  kind?: ProprietaryKind;
  examples: unknown[];
}

declare module "zod" {
  interface ZodTypeDef {
    [metaSymbol]: Metadata;
  }
  interface ZodType {
    example: (example: this["_input"]) => this;
  }
}

/** @link https://github.com/colinhacks/zod/blob/3e4f71e857e75da722bd7e735b6d657a70682df2/src/types.ts#L485 */
const cloneSchema = (schema: z.ZodType) => {
  const copy = schema.describe(schema.description as string);
  copy._def[metaSymbol] = // clone for deep copy, issue #827
    clone(copy._def[metaSymbol]) || ({ examples: [] } satisfies Metadata);
  return copy;
};

if (!(metaSymbol in globalThis)) {
  (globalThis as Record<symbol, unknown>)[metaSymbol] = true;
  z.ZodType.prototype.example = function (
    this,
    value: (typeof this)["_input"],
  ) {
    const copy = cloneSchema(this);
    copy._def[metaSymbol].examples.push(value);
    return copy;
  };
}

export const hasMeta = <T extends z.ZodTypeAny>(schema: T) =>
  metaSymbol in schema._def && isObject(schema._def[metaSymbol]);

export const getMeta = <T extends z.ZodTypeAny, K extends keyof Metadata>(
  schema: T,
  meta: K,
): Readonly<Metadata[K]> | undefined =>
  hasMeta(schema) ? schema._def[metaSymbol][meta] : undefined;

export const copyMeta = <A extends z.ZodTypeAny, B extends z.ZodTypeAny>(
  src: A,
  dest: B,
) => {
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
  return schema;
};

export const isProprietary = (schema: z.ZodTypeAny, kind: ProprietaryKind) =>
  getMeta(schema, "kind") === kind;

/**
 * @deprecated no longer required
 * @todo remove in v19
 * */
export const withMeta = <T extends z.ZodType>(schema: T) => cloneSchema(schema);
