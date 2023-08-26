import { z } from "zod";
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
  Context extends object,
  Variant extends HandlingVariant,
> = {
  schema: T;
} & Context &
  VariantDependingProps<Variant, U>;

export type SchemaHandler<
  T extends z.ZodTypeAny,
  U,
  Context extends object = {},
  Variant extends HandlingVariant = "regular",
> = (params: SchemaHandlingProps<T, U, Context, Variant>) => U;

export type ProprietaryKinds =
  | ZodFileDef["typeName"]
  | ZodUploadDef["typeName"]
  | ZodDateInDef["typeName"]
  | ZodDateOutDef["typeName"];

export type HandlingRules<U, Context extends object = {}> = Partial<
  Record<
    z.ZodFirstPartyTypeKind | ProprietaryKinds,
    SchemaHandler<any, U, Context>
  >
>;

export const walkSchema = <U, Context extends object = {}>({
  schema,
  onEach,
  rules,
  onMissing,
  ...context
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
  const next: SchemaHandler<z.ZodTypeAny, U, {}, "last"> = (params) =>
    walkSchema({
      ...params,
      ...(context as Context),
      onEach,
      rules: rules,
      onMissing,
    });
  const result = handler
    ? handler({
        schema,
        ...(context as Context),
        next,
      })
    : onMissing({ schema, ...(context as Context) });
  const overrides =
    onEach && onEach({ schema, prev: result, ...(context as Context) });
  return overrides ? { ...result, ...overrides } : result;
};
