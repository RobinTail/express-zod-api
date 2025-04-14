import type { $ZodTypeDef } from "@zod/core";
import { fail } from "node:assert/strict"; // eslint-disable-line no-restricted-syntax -- acceptable
import { z } from "zod";
import { EmptyObject } from "./common-helpers";
import { ezDateInBrand } from "./date-in-schema";
import { ezDateOutBrand } from "./date-out-schema";
import { ezFileBrand } from "./file-schema";
import { ezFormBrand, FormSchema } from "./form-schema";
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
    | z.ZodReadonly<z.ZodTypeAny>,
  { next },
) => next(schema.unwrap());

type FirstPartyKind = $ZodTypeDef["type"];

const ioChecks: HandlingRules<boolean, EmptyObject, FirstPartyKind> = {
  object: ({ shape }: z.ZodObject<z.ZodRawShape>, { next }) =>
    Object.values(shape).some(next),
  union: onSomeUnion,
  intersection: onIntersection,
  transform: (schema: z.ZodEffects<z.ZodTypeAny>, { next }) =>
    next(schema.innerType()),
  optional: onWrapped,
  nullable: onWrapped,
  record: ({ valueSchema }: z.ZodRecord, { next }) => next(valueSchema),
  array: ({ element }: z.ZodArray<z.ZodTypeAny>, { next }) => next(element),
  default: ({ _def }: z.ZodDefault<z.ZodTypeAny>, { next }) =>
    next(_def.innerType),
};

interface NestedSchemaLookupProps {
  condition?: (schema: z.ZodType) => boolean;
  rules?: HandlingRules<
    boolean,
    EmptyObject,
    FirstPartyKind | ProprietaryBrand
  >;
  maxDepth?: number;
  depth?: number;
}

/** @desc The optimized version of the schema walker for boolean checks */
export const hasNestedSchema = (
  subject: z.ZodType,
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
      ? rules[subject.meta()?.[metaSymbol]?.brand as keyof typeof rules] ||
        rules[subject._zod.def.type]
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
    condition: (schema) => schema.meta()?.[metaSymbol]?.brand === ezUploadBrand,
    rules: {
      ...ioChecks,
      [ezFormBrand]: (schema: FormSchema, { next }) =>
        Object.values(schema.unwrap().shape).some(next),
    },
  });

export const hasRaw = (subject: IOSchema) =>
  hasNestedSchema(subject, {
    condition: (schema) => schema.meta()?.[metaSymbol]?.brand === ezRawBrand,
    maxDepth: 3,
  });

export const hasForm = (subject: IOSchema) =>
  hasNestedSchema(subject, {
    condition: (schema) => schema.meta()?.[metaSymbol]?.brand === ezFormBrand,
    maxDepth: 3,
  });

/** @throws AssertionError with incompatible schema constructor */
export const assertJsonCompatible = (subject: IOSchema, dir: "in" | "out") => {
  const lazies = new WeakSet<z.ZodLazy<z.ZodTypeAny>>();
  return hasNestedSchema(subject, {
    maxDepth: 300,
    rules: {
      ...ioChecks,
      readonly: onWrapped,
      catch: ({ _def: { innerType } }: z.ZodCatch<z.ZodTypeAny>, { next }) =>
        next(innerType),
      pipe: ({ _def }: z.ZodPipeline<z.ZodTypeAny, z.ZodTypeAny>, { next }) =>
        next(_def[dir]),
      lazy: (lazy: z.ZodLazy<z.ZodTypeAny>, { next }) =>
        lazies.has(lazy) ? false : lazies.add(lazy) && next(lazy.schema),
      tuple: ({ items, _def: { rest } }: z.AnyZodTuple, { next }) =>
        [...items].concat(rest ?? []).some(next),
      transform: { out: undefined, in: ioChecks.ZodEffects }[dir],
      nan: () => fail("z.nan()"),
      symbol: () => fail("z.symbol()"),
      map: () => fail("z.map()"),
      set: () => fail("z.set()"),
      bigint: () => fail("z.bigint()"),
      void: () => fail("z.void()"),
      promise: () => fail("z.promise()"),
      never: () => fail("z.never()"),
      date: () => dir === "in" && fail("z.date()"),
      [ezDateOutBrand]: () => dir === "in" && fail("ez.dateOut()"),
      [ezDateInBrand]: () => dir === "out" && fail("ez.dateIn()"),
      [ezRawBrand]: () => dir === "out" && fail("ez.raw()"),
      [ezUploadBrand]: () => dir === "out" && fail("ez.upload()"),
      [ezFileBrand]: () => false,
    },
  });
};
