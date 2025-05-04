import type {
  $ZodArray,
  $ZodCatch,
  $ZodDefault,
  $ZodDiscriminatedUnion,
  $ZodEnum,
  $ZodIntersection,
  $ZodLazy,
  $ZodLiteral,
  $ZodNullable,
  $ZodObject,
  $ZodOptional,
  $ZodPipe,
  $ZodReadonly,
  $ZodRecord,
  $ZodString,
  $ZodTransform,
  $ZodTuple,
  $ZodUnion,
} from "@zod/core";
import * as R from "ramda";
import ts from "typescript";
import { globalRegistry, z } from "zod";
import { doesAccept, getTransformedType, isSchema } from "./common-helpers";
import { ezDateInBrand } from "./date-in-schema";
import { ezDateOutBrand } from "./date-out-schema";
import { ezFileBrand, FileSchema } from "./file-schema";
import { ProprietaryBrand } from "./proprietary-schemas";
import { ezRawBrand, RawSchema } from "./raw-schema";
import { FirstPartyKind, HandlingRules, walkSchema } from "./schema-walker";
import {
  ensureTypeNode,
  isPrimitive,
  makeInterfaceProp,
  makeLiteralType,
} from "./typescript-api";
import { Producer, ZTSContext } from "./zts-helpers";

const { factory: f } = ts;

const samples = {
  [ts.SyntaxKind.AnyKeyword]: "",
  [ts.SyntaxKind.BigIntKeyword]: BigInt(0),
  [ts.SyntaxKind.BooleanKeyword]: false,
  [ts.SyntaxKind.NumberKeyword]: 0,
  [ts.SyntaxKind.ObjectKeyword]: {},
  [ts.SyntaxKind.StringKeyword]: "",
  [ts.SyntaxKind.UndefinedKeyword]: undefined,
} satisfies Partial<Record<ts.KeywordTypeSyntaxKind, unknown>>;

const nodePath = {
  name: R.path([
    "name" satisfies keyof ts.TypeElement,
    "text" satisfies keyof Exclude<
      NonNullable<ts.TypeElement["name"]>,
      ts.ComputedPropertyName
    >,
  ]),
  type: R.path(["type" satisfies keyof ts.PropertySignature]),
  optional: R.path(["questionToken" satisfies keyof ts.TypeElement]),
};

const onLiteral: Producer = ({ _zod: { def } }: $ZodLiteral) => {
  const values = def.values.map((entry) =>
    entry === undefined
      ? ensureTypeNode(ts.SyntaxKind.UndefinedKeyword)
      : makeLiteralType(entry),
  );
  return values.length === 1 ? values[0] : f.createUnionTypeNode(values);
};

/**
 * @todo determine of makeAlias needed
 * @see https://stackoverflow.com/questions/8591873/determine-if-a-javascript-property-has-a-getter-or-setter-defined
 */
const onObject: Producer = (obj: $ZodObject, { isResponse, next, makeAlias }) =>
  makeAlias(obj, () => {
    const members = Object.entries(obj._zod.def.shape).map<ts.TypeElement>(
      ([key, value]) => {
        const isOptional = isResponse
          ? isSchema<$ZodOptional>(value, "optional")
          : doesAccept(value, undefined);
        const { description: comment, deprecated: isDeprecated } =
          globalRegistry.get(value) || {};
        return makeInterfaceProp(key, next(value), {
          comment,
          isDeprecated,
          isOptional,
        });
      },
    );
    return f.createTypeLiteralNode(members);
  });

const onArray: Producer = ({ _zod: { def } }: $ZodArray, { next }) =>
  f.createArrayTypeNode(next(def.element));

const onEnum: Producer = ({ _zod: { def } }: $ZodEnum) =>
  f.createUnionTypeNode(Object.values(def.entries).map(makeLiteralType));

const onSomeUnion: Producer = (
  { _zod: { def } }: $ZodUnion | $ZodDiscriminatedUnion,
  { next },
) => {
  const nodes = new Map<ts.TypeNode | ts.KeywordTypeSyntaxKind, ts.TypeNode>();
  for (const option of def.options) {
    const node = next(option);
    nodes.set(isPrimitive(node) ? node.kind : node, node);
  }
  return f.createUnionTypeNode(Array.from(nodes.values()));
};

const makeSample = (produced: ts.TypeNode) =>
  samples?.[produced.kind as keyof typeof samples];

const onOptional: Producer = ({ _zod: { def } }: $ZodOptional, { next }) =>
  f.createUnionTypeNode([
    next(def.innerType),
    ensureTypeNode(ts.SyntaxKind.UndefinedKeyword),
  ]);

const onNullable: Producer = ({ _zod: { def } }: $ZodNullable, { next }) =>
  f.createUnionTypeNode([next(def.innerType), makeLiteralType(null)]);

const onTuple: Producer = ({ _zod: { def } }: $ZodTuple, { next }) =>
  f.createTupleTypeNode(
    def.items
      .map(next)
      .concat(def.rest === null ? [] : f.createRestTypeNode(next(def.rest))),
  );

const onRecord: Producer = ({ _zod: { def } }: $ZodRecord, { next }) =>
  ensureTypeNode("Record", [def.keyType, def.valueType].map(next));

const intersect = R.tryCatch(
  (nodes: ts.TypeNode[]) => {
    if (!nodes.every(ts.isTypeLiteralNode)) throw new Error("Not objects");
    const members = R.chain(R.prop("members"), nodes);
    const uniqs = R.uniqWith((...props) => {
      if (!R.eqBy(nodePath.name, ...props)) return false;
      if (R.both(R.eqBy(nodePath.type), R.eqBy(nodePath.optional))(...props))
        return true;
      throw new Error("Has conflicting prop");
    }, members);
    return f.createTypeLiteralNode(uniqs);
  },
  (_err, nodes) => f.createIntersectionTypeNode(nodes),
);

const onIntersection: Producer = (
  { _zod: { def } }: $ZodIntersection,
  { next },
) => intersect([def.left, def.right].map(next));

const onPrimitive =
  (syntaxKind: ts.KeywordTypeSyntaxKind): Producer =>
  () =>
    ensureTypeNode(syntaxKind);

const onWrapped: Producer = (
  { _zod: { def } }: $ZodReadonly | $ZodCatch | $ZodDefault,
  { next },
) => next(def.innerType);

const onPipeline: Producer = (
  { _zod: { def } }: $ZodPipe,
  { next, isResponse },
) => {
  const target = def[isResponse ? "out" : "in"];
  const opposite = def[isResponse ? "in" : "out"];
  if (!isSchema<$ZodTransform>(target, "transform")) return next(target);
  const opposingType = next(opposite);
  const targetType = getTransformedType(target, makeSample(opposingType));
  const resolutions: Partial<
    Record<NonNullable<typeof targetType>, ts.KeywordTypeSyntaxKind>
  > = {
    number: ts.SyntaxKind.NumberKeyword,
    bigint: ts.SyntaxKind.BigIntKeyword,
    boolean: ts.SyntaxKind.BooleanKeyword,
    string: ts.SyntaxKind.StringKeyword,
    undefined: ts.SyntaxKind.UndefinedKeyword,
    object: ts.SyntaxKind.ObjectKeyword,
  };
  return ensureTypeNode(
    (targetType && resolutions[targetType]) || ts.SyntaxKind.AnyKeyword,
  );
};

const onNull: Producer = () => makeLiteralType(null);

const onLazy: Producer = ({ _zod: { def } }: $ZodLazy, { makeAlias, next }) =>
  makeAlias(def.getter, () => next(def.getter()));

const onFile: Producer = (schema: FileSchema) => {
  const stringType = ensureTypeNode(ts.SyntaxKind.StringKeyword);
  const bufferType = ensureTypeNode("Buffer");
  const unionType = f.createUnionTypeNode([stringType, bufferType]);
  return isSchema<$ZodString>(schema, "string")
    ? stringType
    : isSchema<$ZodUnion>(schema, "union")
      ? unionType
      : bufferType;
};

const onRaw: Producer = (schema: RawSchema, { next }) =>
  next(schema._zod.def.shape.raw);

const producers: HandlingRules<
  ts.TypeNode,
  ZTSContext,
  FirstPartyKind | ProprietaryBrand
> = {
  string: onPrimitive(ts.SyntaxKind.StringKeyword),
  number: onPrimitive(ts.SyntaxKind.NumberKeyword),
  bigint: onPrimitive(ts.SyntaxKind.BigIntKeyword),
  boolean: onPrimitive(ts.SyntaxKind.BooleanKeyword),
  any: onPrimitive(ts.SyntaxKind.AnyKeyword),
  undefined: onPrimitive(ts.SyntaxKind.UndefinedKeyword),
  [ezDateInBrand]: onPrimitive(ts.SyntaxKind.StringKeyword),
  [ezDateOutBrand]: onPrimitive(ts.SyntaxKind.StringKeyword),
  null: onNull,
  array: onArray,
  tuple: onTuple,
  record: onRecord,
  object: onObject,
  literal: onLiteral,
  intersection: onIntersection,
  union: onSomeUnion,
  default: onWrapped,
  enum: onEnum,
  optional: onOptional,
  nullable: onNullable,
  catch: onWrapped,
  pipe: onPipeline,
  lazy: onLazy,
  readonly: onWrapped,
  [ezFileBrand]: onFile,
  [ezRawBrand]: onRaw,
};

export const zodToTs = (
  schema: z.ZodType,
  {
    brandHandling,
    ctx,
  }: {
    brandHandling?: HandlingRules<ts.TypeNode, ZTSContext>;
    ctx: ZTSContext;
  },
) =>
  walkSchema(schema, {
    rules: { ...brandHandling, ...producers },
    onMissing: () => ensureTypeNode(ts.SyntaxKind.AnyKeyword),
    ctx,
  });
