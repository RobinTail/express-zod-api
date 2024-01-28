import { z } from "zod";
import { IOSchema } from "./io-schema";
import { isProprietary } from "./metadata";
import { ezRawKind } from "./raw-schema";
import { HandlingRules, SchemaHandler } from "./schema-walker";
import { ezUploadKind } from "./upload-schema";

/** @desc Check is a schema handling rule returning boolean */
type Check<T extends z.ZodTypeAny> = SchemaHandler<T, boolean>;

const onSomeUnion: Check<
  | z.ZodUnion<z.ZodUnionOptions>
  | z.ZodDiscriminatedUnion<string, z.ZodDiscriminatedUnionOption<string>[]>
> = ({ schema: { options }, next }) => options.some(next);

const onIntersection: Check<z.ZodIntersection<z.ZodTypeAny, z.ZodTypeAny>> = ({
  schema: { _def },
  next,
}) => [_def.left, _def.right].some(next);

const onObject: Check<z.ZodObject<z.ZodRawShape>> = ({ schema, next }) =>
  Object.values(schema.shape).some(next);
const onElective: Check<
  z.ZodOptional<z.ZodTypeAny> | z.ZodNullable<z.ZodTypeAny>
> = ({ schema, next }) => next(schema.unwrap());
const onEffects: Check<z.ZodEffects<z.ZodTypeAny>> = ({ schema, next }) =>
  next(schema.innerType());
const onRecord: Check<z.ZodRecord> = ({ schema, next }) =>
  next(schema.valueSchema);
const onArray: Check<z.ZodArray<z.ZodTypeAny>> = ({ schema, next }) =>
  next(schema.element);
const onDefault: Check<z.ZodDefault<z.ZodTypeAny>> = ({ schema, next }) =>
  next(schema._def.innerType);

const checks: HandlingRules<boolean> = {
  ZodObject: onObject,
  ZodUnion: onSomeUnion,
  ZodDiscriminatedUnion: onSomeUnion,
  ZodIntersection: onIntersection,
  ZodEffects: onEffects,
  ZodOptional: onElective,
  ZodNullable: onElective,
  ZodRecord: onRecord,
  ZodArray: onArray,
  ZodDefault: onDefault,
};

/** @desc The optimized version of the schema walker for boolean checks */
export const hasNestedSchema = ({
  subject,
  condition,
  rules = checks,
  depth = 1,
  maxDepth = Number.POSITIVE_INFINITY,
}: {
  subject: z.ZodTypeAny;
  condition: (schema: z.ZodTypeAny) => boolean;
  rules?: HandlingRules<boolean>;
  maxDepth?: number;
  depth?: number;
}): boolean => {
  const early = condition(subject);
  if (early) {
    return early;
  }
  const handler =
    depth < maxDepth
      ? rules[subject._def.typeName as keyof typeof rules]
      : undefined;
  if (handler) {
    return handler({
      schema: subject,
      next: (schema) =>
        hasNestedSchema({
          subject: schema,
          condition,
          rules,
          maxDepth,
          depth: depth + 1,
        }),
    });
  }
  return false;
};

export const hasTranformationOnTop = (subject: IOSchema): boolean =>
  hasNestedSchema({
    subject,
    maxDepth: 3,
    rules: { ZodUnion: onSomeUnion, ZodIntersection: onIntersection },
    condition: (schema) =>
      schema instanceof z.ZodEffects &&
      schema._def.effect.type !== "refinement",
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
