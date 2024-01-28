import { z } from "zod";
import type { FlatObject } from "./common-helpers";
import { getMeta } from "./metadata";
import { ProprietaryKind } from "./proprietary-schemas";

interface VariantDependingProps<U> {
  regular: { next: (schema: z.ZodTypeAny) => U };
  after: { prev: U };
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

/** @since 16.6.0 renamed onEach to afterEach */
export const walkSchema = <U, Context extends FlatObject = {}>({
  schema,
  afterEach,
  rules,
  onMissing,
  ...rest
}: SchemaHandlingProps<z.ZodTypeAny, U, Context, "last"> & {
  afterEach?: SchemaHandler<z.ZodTypeAny, U, Context, "after">;
  onMissing: SchemaHandler<z.ZodTypeAny, U, Context, "last">;
  rules: HandlingRules<U, Context>;
}): U => {
  const ctx = rest as unknown as Context;
  const kind = getMeta(schema, "kind") || schema._def.typeName;
  const handler = kind ? rules[kind as keyof typeof rules] : undefined;
  const next = (subject: z.ZodTypeAny) =>
    walkSchema({ schema: subject, ...ctx, afterEach, rules, onMissing });
  const result = handler
    ? handler({ schema, ...ctx, next })
    : onMissing({ schema, ...ctx });
  const overrides = afterEach && afterEach({ schema, prev: result, ...ctx });
  return overrides ? { ...result, ...overrides } : result;
};

/** @see hasNestedSchema */
export const walkSchemaBool = <U extends boolean>({
  schema,
  beforeEach,
  rules,
  onMissing,
  depth = 1,
  maxDepth = Number.POSITIVE_INFINITY,
}: SchemaHandlingProps<z.ZodTypeAny, U, {}, "last"> & {
  beforeEach: SchemaHandler<z.ZodTypeAny, U, {}, "last">;
  onMissing: SchemaHandler<z.ZodTypeAny, U, {}, "last">;
  rules: HandlingRules<U>;
  maxDepth?: number;
  depth?: number;
}): U => {
  const early = beforeEach({ schema });
  if (early) {
    return early;
  }
  const handler =
    depth < maxDepth
      ? rules[schema._def.typeName as keyof typeof rules]
      : undefined;
  const next = (subject: z.ZodTypeAny) =>
    walkSchemaBool({
      schema: subject,
      beforeEach,
      rules,
      onMissing,
      maxDepth,
      depth: depth + 1,
    });
  return handler ? handler({ schema, next }) : onMissing({ schema });
};
