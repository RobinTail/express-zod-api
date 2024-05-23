import { z } from "zod";
import type { FlatObject } from "./common-helpers";
import { metaSymbol } from "./metadata";

interface VariantDependingProps<U> {
  regular: { next: (schema: z.ZodTypeAny) => U };
  each: { prev: U };
  last: {};
}
type HandlingVariant = keyof VariantDependingProps<unknown>;

export type SchemaHandler<
  U,
  Context extends FlatObject = {},
  Variant extends HandlingVariant = "regular",
> = (
  schema: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  ctx: Context & VariantDependingProps<U>[Variant],
) => U;

export type HandlingRules<
  U,
  Context extends FlatObject = {},
  K extends string | symbol = string | symbol,
> = Partial<Record<K, SchemaHandler<U, Context>>>;

/** @since 10.1.1 calling onEach _after_ handler and giving it the previously achieved result */
export const walkSchema = <U extends object, Context extends FlatObject = {}>(
  schema: z.ZodTypeAny,
  {
    onEach,
    rules,
    onMissing,
    ctx = {} as Context,
  }: {
    ctx?: Context;
    onEach?: SchemaHandler<U, Context, "each">;
    rules: HandlingRules<U, Context>;
    onMissing: SchemaHandler<U, Context, "last">;
  },
): U => {
  const handler =
    rules[schema._def[metaSymbol]?.brand as keyof typeof rules] ||
    rules[schema._def.typeName as keyof typeof rules];
  const next = (subject: z.ZodTypeAny) =>
    walkSchema(subject, { ctx, onEach, rules, onMissing });
  const result = handler
    ? handler(schema, { ...ctx, next })
    : onMissing(schema, ctx);
  const overrides = onEach && onEach(schema, { prev: result, ...ctx });
  return overrides ? { ...result, ...overrides } : result;
};
