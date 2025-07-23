import type { $ZodType } from "zod/v4/core";

export interface NextHandlerInc<U> {
  next: (schema: $ZodType) => U;
}

interface PrevInc<U> {
  prev: U;
}

export type SchemaHandler<
  U,
  Context extends object,
  Variant extends "regular" | "each" | "last" = "regular",
> = (
  schema: $ZodType,
  ctx: Context &
    (Variant extends "regular"
      ? NextHandlerInc<U>
      : Variant extends "each"
        ? PrevInc<U>
        : Context),
) => U;

export const walkSchema = <U extends object, Context extends object>(
  schema: $ZodType,
  {
    onEach,
    getHandler,
    onMissing,
    ctx = {} as Context,
  }: {
    ctx?: Context;
    onEach?: SchemaHandler<U, Context, "each">;
    getHandler: (schema: $ZodType) => SchemaHandler<U, Context> | undefined;
    onMissing: SchemaHandler<U, Context, "last">;
  },
): U => {
  const handler = getHandler(schema);
  const next = (subject: $ZodType) =>
    walkSchema(subject, { ctx, onEach, getHandler, onMissing });
  const result = handler
    ? handler(schema, { ...ctx, next })
    : onMissing(schema, ctx);
  const overrides = onEach && onEach(schema, { prev: result, ...ctx });
  return overrides ? { ...result, ...overrides } : result;
};
