import type {
  $ZodArray,
  $ZodCatch,
  $ZodDefault,
  $ZodDiscriminatedUnion,
  $ZodIntersection,
  $ZodLazy,
  $ZodNullable,
  $ZodObject,
  $ZodOptional,
  $ZodPipe,
  $ZodReadonly,
  $ZodRecord,
  $ZodTuple,
  $ZodType,
  $ZodUnion,
} from "@zod/core";
import { fail } from "node:assert/strict"; // eslint-disable-line no-restricted-syntax -- acceptable
import { globalRegistry } from "zod";
import { EmptyObject } from "./common-helpers";
import { ezDateInBrand } from "./date-in-schema";
import { ezDateOutBrand } from "./date-out-schema";
import { ezFileBrand } from "./file-schema";
import { ezFormBrand } from "./form-schema";
import { IOSchema } from "./io-schema";
import { metaSymbol } from "./metadata";
import { ProprietaryBrand } from "./proprietary-schemas";
import { ezRawBrand } from "./raw-schema";
import {
  FirstPartyKind,
  HandlingRules,
  NextHandlerInc,
  SchemaHandler,
} from "./schema-walker";
import { ezUploadBrand } from "./upload-schema";

/** @desc Check is a schema handling rule returning boolean */
type Check = SchemaHandler<boolean>;

const onSomeUnion: Check = (
  { _zod }: $ZodUnion | $ZodDiscriminatedUnion,
  { next },
) => _zod.def.options.some(next);

const onIntersection: Check = ({ _zod }: $ZodIntersection, { next }) =>
  [_zod.def.left, _zod.def.right].some(next);

const onWrapped: Check = (
  {
    _zod: { def },
  }: $ZodOptional | $ZodNullable | $ZodReadonly | $ZodDefault | $ZodCatch,
  { next },
) => next(def.innerType);

const ioChecks: HandlingRules<boolean, EmptyObject, FirstPartyKind> = {
  object: ({ _zod }: $ZodObject, { next }) =>
    Object.values(_zod.def.shape).some(next),
  union: onSomeUnion,
  intersection: onIntersection,
  optional: onWrapped,
  nullable: onWrapped,
  default: onWrapped,
  record: ({ _zod }: $ZodRecord, { next }) => next(_zod.def.valueType),
  array: ({ _zod }: $ZodArray, { next }) => next(_zod.def.element),
};

interface NestedSchemaLookupProps {
  condition?: (schema: $ZodType) => boolean;
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
  subject: $ZodType,
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
      ? rules[
          globalRegistry.get(subject)?.[metaSymbol]?.brand as keyof typeof rules
        ] || rules[subject._zod.def.type]
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
    condition: (schema) =>
      globalRegistry.get(schema)?.[metaSymbol]?.brand === ezUploadBrand,
    rules: {
      ...ioChecks,
      [ezFormBrand]: ioChecks.object,
    },
  });

export const hasRaw = (subject: IOSchema) =>
  hasNestedSchema(subject, {
    condition: (schema) =>
      globalRegistry.get(schema)?.[metaSymbol]?.brand === ezRawBrand,
    maxDepth: 3,
  });

export const hasForm = (subject: IOSchema) =>
  hasNestedSchema(subject, {
    condition: (schema) =>
      globalRegistry.get(schema)?.[metaSymbol]?.brand === ezFormBrand,
    maxDepth: 3,
  });

/** @throws AssertionError with incompatible schema constructor */
export const assertJsonCompatible = (subject: $ZodType, dir: "in" | "out") => {
  const lazies = new WeakSet<$ZodLazy>();
  return hasNestedSchema(subject, {
    maxDepth: 300,
    rules: {
      ...ioChecks,
      readonly: onWrapped,
      catch: onWrapped,
      pipe: ({ _zod }: $ZodPipe, { next }) => next(_zod.def[dir]),
      lazy: (lazy: $ZodLazy, { next }) =>
        lazies.has(lazy)
          ? false
          : lazies.add(lazy) && next(lazy._zod.def.getter()),
      tuple: ({ _zod: { def } }: $ZodTuple, { next }) =>
        [...def.items].concat(def.rest ?? []).some(next),
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
