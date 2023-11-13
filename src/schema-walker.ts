import { z } from "zod";
import type { FlatObject } from "./common-helpers";
import type { ZodDateInDef } from "./date-in-schema";
import type { ZodDateOutDef } from "./date-out-schema";
import type { ZodFileDef } from "./file-schema";
import type { ZodUploadDef } from "./upload-schema";

export type HandlingVariant = "last" | "regular" | "each";

type VariantDependingProps<
  Variant extends HandlingVariant,
  U,
> = Variant extends "regular"
  ? { next: SchemaHandler<z.ZodTypeAny, U, {}, "last"> }
  : Variant extends "each"
    ? { prev: U }
    : {};

type SchemaHandlingProps<
  T extends z.ZodTypeAny,
  U,
  Context extends FlatObject,
  Variant extends HandlingVariant,
> = {
  schema: T;
} & Context &
  VariantDependingProps<Variant, U>;

export type SchemaHandler<
  T extends z.ZodTypeAny,
  U,
  Context extends FlatObject = {},
  Variant extends HandlingVariant = "regular",
> = (params: SchemaHandlingProps<T, U, Context, Variant>) => U;

export type ProprietaryKinds =
  | ZodFileDef["typeName"]
  | ZodUploadDef["typeName"]
  | ZodDateInDef["typeName"]
  | ZodDateOutDef["typeName"];

export type HandlingRules<U, Context extends FlatObject = {}> = Partial<
  Record<
    z.ZodFirstPartyTypeKind | ProprietaryKinds,
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
  const handler =
    "typeName" in schema._def
      ? rules[schema._def.typeName as keyof typeof rules]
      : undefined;
  const ctx = rest as unknown as Context;
  const next: SchemaHandler<z.ZodTypeAny, U, {}, "last"> = (params) =>
    walkSchema({ ...params, ...ctx, onEach, rules: rules, onMissing });
  const result = handler
    ? handler({ schema, ...ctx, next })
    : onMissing({ schema, ...ctx });
  const overrides = onEach && onEach({ schema, prev: result, ...ctx });
  return overrides ? { ...result, ...overrides } : result;
};
