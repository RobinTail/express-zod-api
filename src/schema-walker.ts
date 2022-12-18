import { z } from "zod";
import { ZodDateInDef } from "./date-in-schema";
import { ZodDateOutDef } from "./date-out-schema";
import { ZodFileDef } from "./file-schema";
import { ZodUploadDef } from "./upload-schema";

export type DepicterVariant = "last" | "regular";
type VariantDependingProps<
  Variant extends DepicterVariant,
  U
> = Variant extends "regular"
  ? {
      next: SchemaDepicter<z.ZodTypeAny, U, {}, "last">;
    }
  : {};

type SchemaDepicterProps<
  T extends z.ZodTypeAny,
  U,
  Context extends object,
  Variant extends DepicterVariant
> = {
  schema: T;
} & Context &
  VariantDependingProps<Variant, U>;

export type SchemaDepicter<
  T extends z.ZodTypeAny,
  U,
  Context extends object = {},
  Variant extends DepicterVariant = "regular"
> = (params: SchemaDepicterProps<T, U, Context, Variant>) => U;

type ProprietaryKinds =
  | ZodFileDef["typeName"]
  | ZodUploadDef["typeName"]
  | ZodDateInDef["typeName"]
  | ZodDateOutDef["typeName"];

export type DepictingRules<U, Context extends object = {}> = Partial<
  Record<
    z.ZodFirstPartyTypeKind | ProprietaryKinds,
    SchemaDepicter<any, U, Context>
  >
>;

export const walkSchema = <U, Context extends object = {}>({
  schema,
  beforeEach,
  afterEach,
  depicters,
  onMissing,
  ...context
}: SchemaDepicterProps<z.ZodTypeAny, U, Context, "last"> & {
  beforeEach: SchemaDepicter<z.ZodTypeAny, U, Context, "last">;
  afterEach?: SchemaDepicter<z.ZodTypeAny, U, Context, "last">;
  depicters: DepictingRules<U, Context>;
  onMissing: (schema: z.ZodTypeAny) => U | void;
}): U => {
  const initial = beforeEach({ schema, ...(context as Context) });
  const final = afterEach && afterEach({ schema, ...(context as Context) });
  const depicter =
    "typeName" in schema._def
      ? depicters[schema._def.typeName as keyof typeof depicters]
      : undefined;
  const next: SchemaDepicter<z.ZodTypeAny, U, {}, "last"> = (params) =>
    walkSchema({
      ...params,
      ...(context as Context),
      beforeEach,
      afterEach,
      depicters,
      onMissing,
    });
  const depiction = depicter
    ? depicter({
        schema,
        ...(context as Context),
        next,
      })
    : onMissing(schema);
  return {
    ...initial,
    ...depiction,
    ...final,
  };
};
