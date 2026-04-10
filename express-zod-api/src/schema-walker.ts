import type { EmptyObject, FlatObject } from "./common-helpers";
import { globalRegistry } from "zod";
import { brandProperty } from "./brand";
import type { z } from "zod";

export type FirstPartyKind = z.core.$ZodTypeDef["type"];

export interface NextHandlerInc<U> {
  next: (schema: z.core.$ZodType) => U;
}

export type SchemaHandler<
  U,
  Context extends FlatObject = EmptyObject,
  Variant extends "regular" | "last" = "regular",
> = (
  schema: any, // eslint-disable-line @typescript-eslint/no-explicit-any -- for assignment compatibility
  ctx: Context & (Variant extends "regular" ? NextHandlerInc<U> : Context),
) => U;

export type HandlingRules<
  U,
  Context extends FlatObject = EmptyObject,
  K extends string | symbol = string | symbol,
> = Partial<Record<K, SchemaHandler<U, Context>>>;

export const walkSchema = <
  U extends object,
  Context extends FlatObject = EmptyObject,
>(
  schema: z.core.$ZodType,
  {
    rules,
    onMissing,
    ctx = {} as Context,
  }: {
    ctx?: Context;
    rules: HandlingRules<U, Context>;
    onMissing: SchemaHandler<U, Context, "last">;
  },
): U => {
  const meta = globalRegistry.get(schema);
  const brand = meta
    ? (meta[brandProperty] as string | number | symbol | undefined)
    : undefined;
  const handler =
    brand && brand in rules
      ? rules[brand as keyof typeof rules]
      : rules[schema._zod.def.type];
  const next = (subject: z.core.$ZodType) =>
    walkSchema(subject, { ctx, rules, onMissing });
  return handler ? handler(schema, { ...ctx, next }) : onMissing(schema, ctx);
};
