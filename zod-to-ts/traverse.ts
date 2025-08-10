import type { z } from "zod";

interface NextHandlerInc<U> {
  next: (schema: z.core.$ZodType) => U;
}

export type SchemaHandler<
  U,
  Context extends object,
  Variant extends "regular" | "last" = "regular",
> = (
  schema: any, // eslint-disable-line @typescript-eslint/no-explicit-any -- for assignment compatibility
  ctx: Context & (Variant extends "regular" ? NextHandlerInc<U> : Context),
) => U;

export type HandlingRules<
  U,
  Context extends object,
  K extends PropertyKey = PropertyKey,
> = Partial<Record<K, SchemaHandler<U, Context>>>;

export const traverse = <U, Context extends object>(
  schema: z.core.$ZodType,
  {
    rules,
    onMissing,
    ctx = {} as Context,
    getRule = (one) => one._zod.def.type,
  }: {
    rules: HandlingRules<U, Context>;
    onMissing: SchemaHandler<U, Context, "last">;
    ctx?: Context;
    /** @todo consider combining/replacing rules */
    getRule?: (subject: typeof schema) => keyof typeof rules;
  },
): U => {
  const handler = rules[getRule(schema)];
  const next = (subject: z.core.$ZodType) =>
    traverse(subject, { ctx, rules, getRule, onMissing });
  return handler ? handler(schema, { ...ctx, next }) : onMissing(schema, ctx);
};
