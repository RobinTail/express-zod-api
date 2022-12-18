import { z } from "zod";
import { ZodDateInDef } from "./date-in-schema";
import { ZodDateOutDef } from "./date-out-schema";
import { ZodFileDef } from "./file-schema";
import { ZodUploadDef } from "./upload-schema";

type InitialDepicterProps<T extends z.ZodTypeAny, ExtraProps> = {
  schema: T;
} & ExtraProps;
export type InitialDepicter<T extends z.ZodTypeAny, U, ExtraProps> = (
  params: InitialDepicterProps<T, ExtraProps>
) => U;

type SchemaDepicterProps<
  T extends z.ZodTypeAny,
  U,
  ExtraProps
> = InitialDepicterProps<T, ExtraProps> & {
  next: InitialDepicter<z.ZodTypeAny, U, {}>;
};

export type SchemaDepicter<T extends z.ZodTypeAny, U, ExtraProps> = (
  params: SchemaDepicterProps<T, U, ExtraProps>
) => U;

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
}: InitialDepicterProps<z.ZodTypeAny, ExtraProps> & {
  beforeEach: InitialDepicter<z.ZodTypeAny, U, ExtraProps>;
  afterEach: InitialDepicter<z.ZodTypeAny, U, ExtraProps>;
  depicters: DepictingRules<U, ExtraProps>;
  onMissing: (schema: z.ZodTypeAny) => U | void;
}): U => {
  const initial = beforeEach({ schema, ...(rest as ExtraProps) });
  const final = afterEach({ schema, ...(rest as ExtraProps) });
  const depicter =
    "typeName" in schema._def
      ? depicters[schema._def.typeName as keyof typeof depicters]
      : undefined;
  const next: InitialDepicter<z.ZodTypeAny, U, {}> = (params) =>
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
