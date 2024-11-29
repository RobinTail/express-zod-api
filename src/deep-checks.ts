import { fail } from "node:assert/strict"; // eslint-disable-line no-restricted-syntax -- acceptable
import { z } from "zod";
import { EmptyObject } from "./common-helpers";
import { ezDateInBrand } from "./date-in-schema";
import { ezDateOutBrand } from "./date-out-schema";
import { ezFileBrand } from "./file-schema";
import { IOSchema } from "./io-schema";
import { metaSymbol } from "./metadata";
import { ProprietaryBrand } from "./proprietary-schemas";
import { ezRawBrand } from "./raw-schema";
import { HandlingRules, NextHandlerInc, SchemaHandler } from "./schema-walker";
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

const onWrapped: Check = (
  schema:
    | z.ZodOptional<z.ZodTypeAny>
    | z.ZodNullable<z.ZodTypeAny>
    | z.ZodReadonly<z.ZodTypeAny>
    | z.ZodBranded<z.ZodTypeAny, string | number | symbol>,
  { next },
) => next(schema.unwrap());

const ioChecks: HandlingRules<boolean, EmptyObject, z.ZodFirstPartyTypeKind> = {
  ZodObject: ({ shape }: z.ZodObject<z.ZodRawShape>, { next }) =>
    Object.values(shape).some(next),
  ZodUnion: onSomeUnion,
  ZodDiscriminatedUnion: onSomeUnion,
  ZodIntersection: onIntersection,
  ZodEffects: (schema: z.ZodEffects<z.ZodTypeAny>, { next }) =>
    next(schema.innerType()),
  ZodOptional: onWrapped,
  ZodNullable: onWrapped,
  ZodRecord: ({ valueSchema }: z.ZodRecord, { next }) => next(valueSchema),
  ZodArray: ({ element }: z.ZodArray<z.ZodTypeAny>, { next }) => next(element),
  ZodDefault: ({ _def }: z.ZodDefault<z.ZodTypeAny>, { next }) =>
    next(_def.innerType),
};

interface NestedSchemaLookupProps {
  condition?: (schema: z.ZodTypeAny) => boolean;
  rules?: HandlingRules<
    boolean,
    EmptyObject,
    z.ZodFirstPartyTypeKind | ProprietaryBrand
  >;
  maxDepth?: number;
  depth?: number;
}

/** @desc The optimized version of the schema walker for boolean checks */
export const hasNestedSchema = (
  subject: z.ZodTypeAny,
  {
    condition,
    rules = ioChecks,
    depth = 1,
    maxDepth = Number.POSITIVE_INFINITY,
  }: NestedSchemaLookupProps,
): boolean => {
  if (condition?.(subject)) return true;
  const handler =
    depth < maxDepth
      ? rules[subject._def[metaSymbol]?.brand as keyof typeof rules] ||
        rules[subject._def.typeName as keyof typeof rules]
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
    } as EmptyObject & NextHandlerInc<boolean>);
  }
  return false;
};

export const hasUpload = (subject: IOSchema) =>
  hasNestedSchema(subject, {
    condition: (schema) => schema._def[metaSymbol]?.brand === ezUploadBrand,
  });

export const hasRaw = (subject: IOSchema) =>
  hasNestedSchema(subject, {
    condition: (schema) => schema._def[metaSymbol]?.brand === ezRawBrand,
    maxDepth: 3,
  });

/** @throws AssertionError with incompatible schema constructor */
export const assertJsonCompatible = (subject: IOSchema, dir: "in" | "out") => {
  const lazies = new WeakSet<z.ZodLazy<z.ZodTypeAny>>();
  return hasNestedSchema(subject, {
    maxDepth: 300,
    rules: {
      ...ioChecks,
      ZodBranded: onWrapped,
      ZodReadonly: onWrapped,
      ZodCatch: ({ _def: { innerType } }: z.ZodCatch<z.ZodTypeAny>, { next }) =>
        next(innerType),
      ZodPipeline: (
        { _def }: z.ZodPipeline<z.ZodTypeAny, z.ZodTypeAny>,
        { next },
      ) => next(_def[dir]),
      ZodLazy: (lazy: z.ZodLazy<z.ZodTypeAny>, { next }) =>
        lazies.has(lazy) ? false : lazies.add(lazy) && next(lazy.schema),
      ZodTuple: ({ items, _def: { rest } }: z.AnyZodTuple, { next }) =>
        [...items].concat(rest ?? []).some(next),
      ZodEffects: { out: undefined, in: ioChecks.ZodEffects }[dir],
      ZodNaN: () => fail("z.nan()"),
      ZodSymbol: () => fail("z.symbol()"),
      ZodFunction: () => fail("z.function()"),
      ZodMap: () => fail("z.map()"),
      ZodSet: () => fail("z.set()"),
      ZodBigInt: () => fail("z.bigint()"),
      ZodVoid: () => fail("z.void()"),
      ZodPromise: () => fail("z.promise()"),
      ZodNever: () => fail("z.never()"),
      ZodDate: () => dir === "in" && fail("z.date()"),
      [ezDateOutBrand]: () => dir === "in" && fail("ez.dateOut()"),
      [ezDateInBrand]: () => dir === "out" && fail("ez.dateIn()"),
      [ezRawBrand]: () => dir === "out" && fail("ez.raw()"),
      [ezUploadBrand]: () => dir === "out" && fail("ez.upload()"),
      [ezFileBrand]: () => false,
    },
  });
};
