import { ZodEffects, z } from "zod";
import { IOSchema } from "./io-schema";
import { isProprietary } from "./metadata";
import { ezRawKind } from "./raw-schema";
import { SchemaHandler, walkSchema } from "./schema-walker";
import { ezUploadKind } from "./upload-schema";

type Check<T extends z.ZodTypeAny> = SchemaHandler<T, boolean>;

const onSomeUnion: Check<
  | z.ZodUnion<z.ZodUnionOptions>
  | z.ZodDiscriminatedUnion<string, z.ZodDiscriminatedUnionOption<string>[]>
> = ({ schema, next }) =>
  schema.options.some((entry) => next({ schema: entry }));

const onIntersection: Check<z.ZodIntersection<z.ZodTypeAny, z.ZodTypeAny>> = ({
  schema,
  next,
}) =>
  [schema._def.left, schema._def.right].some((entry) =>
    next({ schema: entry }),
  );

const onObject: Check<z.ZodObject<z.ZodRawShape>> = ({ schema, next }) =>
  Object.values(schema.shape).some((entry) => next({ schema: entry }));
const onOptional: Check<
  z.ZodOptional<z.ZodTypeAny> | z.ZodNullable<z.ZodTypeAny>
> = ({ schema, next }) => next({ schema: schema.unwrap() });
const onEffects: Check<z.ZodEffects<z.ZodTypeAny>> = ({ schema, next }) =>
  next({ schema: schema.innerType() });
const onRecord: Check<z.ZodRecord> = ({ schema, next }) =>
  next({ schema: schema.valueSchema });
const onArray: Check<z.ZodArray<z.ZodTypeAny>> = ({ schema, next }) =>
  next({ schema: schema.element });
const onDefault: Check<z.ZodDefault<z.ZodTypeAny>> = ({ schema, next }) =>
  next({ schema: schema._def.innerType });

export const hasTopLevelTransformingEffect = (subject: IOSchema): boolean => {
  return walkSchema({
    schema: subject,
    rules: {
      ZodEffects: ({ schema }) =>
        (schema as ZodEffects<z.ZodTypeAny>)._def.effect.type !== "refinement",
      ZodUnion: onSomeUnion, // can not be discriminated union
      ZodIntersection: onIntersection,
    },
    onMissing: () => false,
  });
};

export const hasNestedSchema = ({
  subject,
  condition,
  maxDepth,
}: {
  subject: z.ZodTypeAny;
  condition: (schema: z.ZodTypeAny) => boolean;
  maxDepth?: number;
}): boolean =>
  walkSchema({
    schema: subject,
    onMissing: () => false,
    onEach: ({ schema }) => condition(schema),
    maxDepth,
    rules: {
      ZodObject: onObject,
      ZodUnion: onSomeUnion,
      ZodDiscriminatedUnion: onSomeUnion,
      ZodIntersection: onIntersection,
      ZodOptional: onOptional,
      ZodNullable: onOptional,
      ZodEffects: onEffects,
      ZodRecord: onRecord,
      ZodArray: onArray,
      ZodDefault: onDefault,
    },
  });

export const hasUpload = (subject: IOSchema) =>
  hasNestedSchema({
    subject,
    condition: (schema) => isProprietary(schema, ezUploadKind),
  });

export const hasRaw = (subject: IOSchema) =>
  hasNestedSchema({
    subject,
    condition: (schema) => isProprietary(schema, ezRawKind),
    maxDepth: 3,
  });
