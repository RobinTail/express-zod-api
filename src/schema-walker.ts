import { z } from "zod";
import type { FlatObject } from "./common-helpers";
import { getMeta } from "./metadata";
import { ProprietaryKind } from "./proprietary-schemas";

interface VariantDependingProps<U> {
  regular: { next: SchemaHandler<z.ZodTypeAny, U, {}, "last"> };
  each: { prev: U };
  last: {};
}

export type HandlingVariant = keyof VariantDependingProps<unknown>;

type SchemaHandlingProps<
  T extends z.ZodTypeAny,
  U,
  Context extends FlatObject,
  Variant extends HandlingVariant,
> = Context &
  VariantDependingProps<U>[Variant] & {
    schema: T;
  };

export type SchemaHandler<
  T extends z.ZodTypeAny,
  U,
  Context extends FlatObject = {},
  Variant extends HandlingVariant = "regular",
> = (params: SchemaHandlingProps<T, U, Context, Variant>) => U;

export type HandlingRules<U, Context extends FlatObject = {}> = Partial<
  Record<
    z.ZodFirstPartyTypeKind | ProprietaryKind,
    SchemaHandler<any, U, Context> // keeping "any" here in order to avoid excessive complexity
  >
>;

/**
 * @since 16.6.0 renamed onEach to after, added before and maxDepth
 * @see hasNestedSchema
 * */
export const walkSchema = <U, Context extends FlatObject = {}>({
  schema,
  after,
  rules,
  onMissing,
  before,
  depth = 1,
  maxDepth = Number.POSITIVE_INFINITY,
  ...rest
}: SchemaHandlingProps<z.ZodTypeAny, U, Context, "last"> & {
  before?: SchemaHandler<z.ZodTypeAny, U, Context, "last">;
  after?: SchemaHandler<z.ZodTypeAny, U, Context, "each">;
  onMissing: SchemaHandler<z.ZodTypeAny, U, Context, "last">;
  rules: HandlingRules<U, Context>;
  maxDepth?: number;
  depth?: number;
}): U => {
  const ctx = rest as unknown as Context;
  const kind = getMeta(schema, "kind") || schema._def.typeName;
  const handler =
    kind && depth < maxDepth ? rules[kind as keyof typeof rules] : undefined;
  const next: SchemaHandler<z.ZodTypeAny, U, {}, "last"> = (params) =>
    walkSchema({
      ...params,
      ...ctx,
      before,
      after,
      rules,
      onMissing,
      maxDepth,
      depth: depth + 1,
    });
  const dive = () =>
    handler ? handler({ schema, ...ctx, next }) : onMissing({ schema, ...ctx });
  const early = before && before({ schema, ...ctx });
  const result =
    typeof early === "boolean" ? early || dive() : { ...early, ...dive() };
  const overrides = after && after({ schema, prev: result, ...ctx });
  return typeof result === "boolean"
    ? overrides || result
    : { ...result, ...overrides };
};
