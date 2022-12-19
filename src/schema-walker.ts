import { z } from "zod";
import { ZodDateInDef } from "./date-in-schema";
import { ZodDateOutDef } from "./date-out-schema";
import { ZodFileDef } from "./file-schema";
import { ZodUploadDef } from "./upload-schema";

export type HandlingVariant = "last" | "regular";
type VariantDependingProps<
  Variant extends HandlingVariant,
  U
> = Variant extends "regular"
  ? {
      next: SchemaHandler<z.ZodTypeAny, U, {}, "last">;
    }
  : {};

type SchemaHandlingProps<
  T extends z.ZodTypeAny,
  U,
  Context extends object,
  Variant extends HandlingVariant
> = {
  schema: T;
} & Context &
  VariantDependingProps<Variant, U>;

export type SchemaHandler<
  T extends z.ZodTypeAny,
  U,
  Context extends object = {},
  Variant extends HandlingVariant = "regular"
> = (params: SchemaHandlingProps<T, U, Context, Variant>) => U;

type ProprietaryKinds =
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
  onEach?: SchemaHandler<z.ZodTypeAny, U, Context, "last">;
  rules: HandlingRules<U, Context>;
  onMissing: (schema: z.ZodTypeAny) => U;
}): U => {
  const overrides = onEach && onEach({ schema, ...(context as Context) });
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
    : onMissing(schema);
  return overrides ? { ...result, ...overrides } : result;
};
