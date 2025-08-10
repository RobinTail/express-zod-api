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
    getHandler,
    onMissing,
    ctx = {} as Context,
  }: {
    getHandler: (
      subject: typeof schema,
    ) => SchemaHandler<U, Context> | undefined;
    onMissing: SchemaHandler<U, Context, "last">;
    ctx?: Context;
  },
): U => {
  const handler = getHandler(schema);
  const next = (subject: z.core.$ZodType) =>
    traverse(subject, { ctx, getHandler, onMissing });
  return handler ? handler(schema, { ...ctx, next }) : onMissing(schema, ctx);
};
