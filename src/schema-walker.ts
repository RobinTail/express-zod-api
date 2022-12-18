import { z } from "zod";
import { ZodDateInDef } from "./date-in-schema";
import { ZodDateOutDef } from "./date-out-schema";
import { ZodFileDef } from "./file-schema";
import { ZodUploadDef } from "./upload-schema";

interface SchemaDepicterProps<T extends z.ZodTypeAny, U> {
  schema: T;
  initial?: U;
  isResponse: boolean;
}

export type SchemaDepicter<T extends z.ZodTypeAny, U> = (
  params: SchemaDepicterProps<T, U>
) => U;

type ProprietaryKinds =
  | ZodFileDef["typeName"]
  | ZodUploadDef["typeName"]
  | ZodDateInDef["typeName"]
  | ZodDateOutDef["typeName"];

export type DepictingRules<U> = Partial<
  Record<z.ZodFirstPartyTypeKind | ProprietaryKinds, SchemaDepicter<any, U>>
>;

export const walkSchema = <T extends z.ZodTypeAny, U>({
  schema,
  isResponse,
  beforeEach,
  depicters,
}: Omit<SchemaDepicterProps<T, U>, "initial"> & {
  beforeEach: SchemaDepicter<T, U>;
  depicters: DepictingRules<U>;
}): U => {
  const initial = beforeEach({ schema, isResponse });
  const depicter =
    "typeName" in schema._def
      ? depicters[schema._def.typeName as keyof typeof depicters]
      : undefined;
  if (!depicter) {
    // @todo use another error
    throw new Error(`Zod type ${schema.constructor.name} is unsupported`);
  }
  return depicter({ schema, initial, isResponse });
};
