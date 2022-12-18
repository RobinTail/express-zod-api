import { z } from "zod";
import { ZodDateInDef } from "./date-in-schema";
import { ZodDateOutDef } from "./date-out-schema";
import { ZodFileDef } from "./file-schema";
import { ZodUploadDef } from "./upload-schema";

type SchemaDepicterProps<T extends z.ZodTypeAny, U, ExtraProps> = {
  schema: T;
  initial?: U;
} & ExtraProps;

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

export const walkSchema = <T extends z.ZodTypeAny, U, ExtraProps>({
  schema,
  beforeEach,
  depicters,
  ...rest
}: Omit<SchemaDepicterProps<T, U, ExtraProps>, "initial"> & {
  beforeEach: SchemaDepicter<T, U, ExtraProps>;
  depicters: DepictingRules<U, ExtraProps>;
}): U => {
  const initial = beforeEach({ schema, ...(rest as ExtraProps) });
  const depicter =
    "typeName" in schema._def
      ? depicters[schema._def.typeName as keyof typeof depicters]
      : undefined;
  if (!depicter) {
    // @todo use another error
    throw new Error(`Zod type ${schema.constructor.name} is unsupported`);
  }
  return depicter({ schema, initial, ...(rest as ExtraProps) });
};
