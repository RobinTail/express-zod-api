import { z } from "zod";
import { ZodDateInDef } from "./date-in-schema";
import { ZodDateOutDef } from "./date-out-schema";
import { ZodFileDef } from "./file-schema";
import { ZodUploadDef } from "./upload-schema";

type SchemaDepicterProps<
  T extends z.ZodTypeAny,
  U,
  ExtraProps,
  Variant extends "last" | undefined = undefined
> = {
  schema: T;
} & ExtraProps &
  (Variant extends "last"
    ? {}
    : {
        next: SchemaDepicter<z.ZodTypeAny, U, {}, "last">;
      });

export type SchemaDepicter<
  T extends z.ZodTypeAny,
  U,
  ExtraProps,
  Variant extends "last" | undefined = undefined
> = (params: SchemaDepicterProps<T, U, ExtraProps, Variant>) => U;

type ProprietaryKinds =
  | ZodFileDef["typeName"]
  | ZodUploadDef["typeName"]
  | ZodDateInDef["typeName"]
  | ZodDateOutDef["typeName"];

export type DepictingRules<U, ExtraProps> = Partial<
  Record<
    z.ZodFirstPartyTypeKind | ProprietaryKinds,
    SchemaDepicter<any, U, ExtraProps>
  >
>;

export const walkSchema = <U, ExtraProps>({
  schema,
  beforeEach,
  afterEach,
  depicters,
  onMissing,
  ...rest
}: SchemaDepicterProps<z.ZodTypeAny, U, ExtraProps, "last"> & {
  beforeEach: SchemaDepicter<z.ZodTypeAny, U, ExtraProps, "last">;
  afterEach: SchemaDepicter<z.ZodTypeAny, U, ExtraProps, "last">;
  depicters: DepictingRules<U, ExtraProps>;
  onMissing: (schema: z.ZodTypeAny) => U | void;
}): U => {
  const initial = beforeEach({ schema, ...(rest as ExtraProps) });
  const final = afterEach({ schema, ...(rest as ExtraProps) });
  const depicter =
    "typeName" in schema._def
      ? depicters[schema._def.typeName as keyof typeof depicters]
      : undefined;
  const next: SchemaDepicter<z.ZodTypeAny, U, {}, "last"> = (params) =>
    walkSchema({
      ...params,
      ...(rest as ExtraProps),
      beforeEach,
      afterEach,
      depicters,
      onMissing,
    });
  const depiction = depicter
    ? depicter({
        schema,
        ...(rest as ExtraProps),
        next,
      })
    : onMissing(schema);
  if (!depicter) {
    onMissing(schema);
  }
  return {
    ...initial,
    ...depiction,
    ...final,
  };
};
