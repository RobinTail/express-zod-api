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
 * @since 10.1.1 calling onEach _after_ handler and giving it the previously achieved result
 * @since 16.6.0 check runs before handler in order to terminate traversing early
 * @since 16.6.0 maintains depth argument controllable by maxDepth option
 * @see hasNestedSchema
 * */
export const walkSchema = <U, Context extends FlatObject = {}>({
  schema,
  onEach,
  rules,
  onMissing,
  check,
  depth = 1,
  maxDepth = Number.POSITIVE_INFINITY,
  ...rest
}: SchemaHandlingProps<z.ZodTypeAny, U, Context, "last"> & {
  check?: SchemaHandler<z.ZodTypeAny, U & boolean, Context, "last">;
  onEach?: SchemaHandler<z.ZodTypeAny, U, Context, "each">;
  rules: HandlingRules<U, Context>;
  onMissing: SchemaHandler<z.ZodTypeAny, U, Context, "last">;
  maxDepth?: number;
  depth?: number;
}): U => {
  const ctx = rest as unknown as Context;
  const checked = check && check({ schema, ...ctx });
  if (checked === true) {
    return checked;
  }
  const kind = getMeta(schema, "kind") || schema._def.typeName;
  const handler =
    kind && depth < maxDepth ? rules[kind as keyof typeof rules] : undefined;
  const next: SchemaHandler<z.ZodTypeAny, U, {}, "last"> = (params) =>
    walkSchema({
      ...params,
      ...ctx,
      onEach,
      rules,
      onMissing,
      maxDepth,
      check,
      depth: depth + 1,
    });
  const result = handler
    ? handler({ schema, ...ctx, next })
    : onMissing({ schema, ...ctx });
  const overrides = onEach && onEach({ schema, prev: result, ...ctx });
  return overrides ? { ...result, ...overrides } : result;
};
