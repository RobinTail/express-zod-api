import type { $ZodType } from "zod/v4/core";

export interface NextHandlerInc<U> {
  next: (schema: $ZodType) => U;
}

export type SchemaHandler<
  U,
  Context extends object,
  Variant extends "regular" | "last" = "regular",
> = (
  schema: $ZodType,
  ctx: Context & (Variant extends "regular" ? NextHandlerInc<U> : Context),
) => U;

export const walkSchema = <U extends object, Context extends object>(
  schema: $ZodType,
  {
    getHandler,
    onMissing,
    ctx = {} as Context,
  }: {
    ctx?: Context;
    getHandler: (schema: $ZodType) => SchemaHandler<U, Context> | undefined;
    onMissing: SchemaHandler<U, Context, "last">;
  },
): U => {
  const handler = getHandler(schema);
  const next = (subject: $ZodType) =>
    walkSchema(subject, { ctx, getHandler, onMissing });
  return handler ? handler(schema, { ...ctx, next }) : onMissing(schema, ctx);
};
