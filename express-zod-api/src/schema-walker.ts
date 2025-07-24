import type { $ZodType, $ZodTypeDef } from "zod/v4/core";
import type { EmptyObject, FlatObject } from "./common-helpers";

export type FirstPartyKind = $ZodTypeDef["type"];

export interface NextHandlerInc<U> {
  next: (schema: $ZodType) => U;
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
