import { z } from "zod";
import { IOSchema } from "./io-schema";
import { metaSymbol } from "./metadata";
import { ezRawBrand } from "./raw-schema";
import { HandlingRules, SchemaHandler } from "./schema-walker";
import { ezUploadBrand } from "./upload-schema";

/** @desc Check is a schema handling rule returning boolean */
type Check = SchemaHandler<boolean>;

const onSomeUnion: Check = (
  schema:
    | z.ZodUnion<z.ZodUnionOptions>
    | z.ZodDiscriminatedUnion<string, z.ZodDiscriminatedUnionOption<string>[]>,
  { next },
) => schema.options.some(next);

const onIntersection: Check = (
  { _def }: z.ZodIntersection<z.ZodTypeAny, z.ZodTypeAny>,
  { next },
) => [_def.left, _def.right].some(next);

const onElective: Check = (
  schema: z.ZodOptional<z.ZodTypeAny> | z.ZodNullable<z.ZodTypeAny>,
  { next },
) => next(schema.unwrap());

const checks: HandlingRules<boolean> = {
  ZodObject: ({ shape }: z.ZodObject<z.ZodRawShape>, { next }) =>
    Object.values(shape).some(next),
  ZodUnion: onSomeUnion,
  ZodDiscriminatedUnion: onSomeUnion,
  ZodIntersection: onIntersection,
  ZodEffects: (schema: z.ZodEffects<z.ZodTypeAny>, { next }) =>
    next(schema.innerType()),
  ZodOptional: onElective,
  ZodNullable: onElective,
  ZodRecord: ({ valueSchema }: z.ZodRecord, { next }) => next(valueSchema),
  ZodArray: ({ element }: z.ZodArray<z.ZodTypeAny>, { next }) => next(element),
  ZodDefault: ({ _def }: z.ZodDefault<z.ZodTypeAny>, { next }) =>
    next(_def.innerType),
};

/** @desc The optimized version of the schema walker for boolean checks */
export const hasNestedSchema = (
  subject: z.ZodTypeAny,
  {
    condition,
    rules = checks,
    depth = 1,
    maxDepth = Number.POSITIVE_INFINITY,
  }: {
    condition: (schema: z.ZodTypeAny) => boolean;
    rules?: HandlingRules<boolean>;
    maxDepth?: number;
    depth?: number;
  },
): boolean => {
  if (condition(subject)) {
    return true;
  }
  const handler =
    depth < maxDepth
      ? rules[subject._def.typeName as keyof typeof rules]
      : undefined;
  if (handler) {
    return handler(subject, {
      next: (schema) =>
        hasNestedSchema(schema, {
          condition,
          rules,
          maxDepth,
          depth: depth + 1,
        }),
    });
  }
  return false;
};

export const hasTransformationOnTop = (subject: IOSchema): boolean =>
  hasNestedSchema(subject, {
    maxDepth: 3,
    rules: { ZodUnion: onSomeUnion, ZodIntersection: onIntersection },
    condition: (schema) =>
      schema instanceof z.ZodEffects &&
      schema._def.effect.type !== "refinement",
  });

export const hasUpload = (subject: IOSchema) =>
  hasNestedSchema(subject, {
    condition: (schema) => schema._def[metaSymbol]?.brand === ezUploadBrand,
  });

export const hasRaw = (subject: IOSchema) =>
  hasNestedSchema(subject, {
    condition: (schema) => schema._def[metaSymbol]?.brand === ezRawBrand,
    maxDepth: 3,
  });
