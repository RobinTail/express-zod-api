import { z } from "zod";
import type { EmptyObject, FlatObject } from "./common-helpers";
import { metaSymbol } from "./metadata";

export interface NextHandlerInc<U> {
  next: (schema: z.ZodTypeAny) => U;
}

interface PrevInc<U> {
  prev: U;
}

export type SchemaHandler<
  U,
  Context extends FlatObject = EmptyObject,
  Variant extends "regular" | "each" | "last" = "regular",
> = (
  schema: any, // eslint-disable-line @typescript-eslint/no-explicit-any -- for assignment compatibility
  ctx: Context &
    (Variant extends "regular"
      ? NextHandlerInc<U>
      : Variant extends "each"
        ? PrevInc<U>
        : Context),
) => U;

export type HandlingRules<
  U,
  Context extends FlatObject = EmptyObject,
  K extends string | symbol = string | symbol,
> = Partial<Record<K, SchemaHandler<U, Context>>>;

/** @since 10.1.1 calling onEach _after_ handler and giving it the previously achieved result */
export const walkSchema = <
  U extends object,
  Context extends FlatObject = EmptyObject,
>(
  schema: z.ZodType,
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
    rules[schema.meta()?.[metaSymbol]?.brand as keyof typeof rules] ||
    ("typeName" in schema._def &&
      rules[schema._def.typeName as keyof typeof rules]);
  const next = (subject: z.ZodTypeAny) =>
    walkSchema(subject, { ctx, onEach, rules, onMissing });
  const result = handler
    ? handler(schema, { ...ctx, next })
    : onMissing(schema, ctx);
  const overrides = onEach && onEach(schema, { prev: result, ...ctx });
  return overrides ? { ...result, ...overrides } : result;
};
