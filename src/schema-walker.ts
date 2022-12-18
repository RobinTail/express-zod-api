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
  Specifics extends object,
  Variant extends DepicterVariant
> = {
  schema: T;
} & Specifics &
  VariantDependingProps<Variant, U>;

export type SchemaDepicter<
  T extends z.ZodTypeAny,
  U,
  Specifics extends object = {},
  Variant extends DepicterVariant = "regular"
> = (params: SchemaDepicterProps<T, U, Specifics, Variant>) => U;

type ProprietaryKinds =
  | ZodFileDef["typeName"]
  | ZodUploadDef["typeName"]
  | ZodDateInDef["typeName"]
  | ZodDateOutDef["typeName"];

export type DepictingRules<U, Specifics extends object = {}> = Partial<
  Record<
    z.ZodFirstPartyTypeKind | ProprietaryKinds,
    SchemaDepicter<any, U, Specifics>
  >
>;

export const walkSchema = <U, Specifics extends object = {}>({
  schema,
  beforeEach,
  afterEach,
  depicters,
  onMissing,
  ...rest
}: SchemaDepicterProps<z.ZodTypeAny, U, Specifics, "last"> & {
  beforeEach: SchemaDepicter<z.ZodTypeAny, U, Specifics, "last">;
  afterEach: SchemaDepicter<z.ZodTypeAny, U, Specifics, "last">;
  depicters: DepictingRules<U, Specifics>;
  onMissing: (schema: z.ZodTypeAny) => U | void;
}): U => {
  const initial = beforeEach({ schema, ...(rest as Specifics) });
  const final = afterEach({ schema, ...(rest as Specifics) });
  const depicter =
    "typeName" in schema._def
      ? depicters[schema._def.typeName as keyof typeof depicters]
      : undefined;
  const next: SchemaDepicter<z.ZodTypeAny, U, {}, "last"> = (params) =>
    walkSchema({
      ...params,
      ...(rest as Specifics),
      beforeEach,
      afterEach,
      depicters,
      onMissing,
    });
  const depiction = depicter
    ? depicter({
        schema,
        ...(rest as Specifics),
        next,
      })
    : onMissing(schema);
  return {
    ...initial,
    ...depiction,
    ...final,
  };
};
