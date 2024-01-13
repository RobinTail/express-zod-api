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

export const walkSchema = <U, Context extends FlatObject = {}>({
  schema,
  onEach,
  rules,
  onMissing,
  ...rest
}: SchemaHandlingProps<z.ZodTypeAny, U, Context, "last"> & {
  /** @since 10.1.1 calling onEach _after_ handler and giving it its result */
  onEach?: SchemaHandler<z.ZodTypeAny, U, Context, "each">;
  rules: HandlingRules<U, Context>;
  onMissing: SchemaHandler<z.ZodTypeAny, U, Context, "last">;
}): U => {
  const kind = getMeta(schema, "kind") || schema._def.typeName;
  const handler = kind ? rules[kind as keyof typeof rules] : undefined;
  const ctx = rest as unknown as Context;
  const next: SchemaHandler<z.ZodTypeAny, U, {}, "last"> = (params) =>
    walkSchema({ ...params, ...ctx, onEach, rules: rules, onMissing });
  const result = handler
    ? handler({ schema, ...ctx, next })
    : onMissing({ schema, ...ctx });
  const overrides = onEach && onEach({ schema, prev: result, ...ctx });
  return overrides ? { ...result, ...overrides } : result;
};
