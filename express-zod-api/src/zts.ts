import * as R from "ramda";
import ts from "typescript";
import { z } from "zod";
import { getTransformedType } from "./common-helpers";
import { ezDateInBrand } from "./date-in-schema";
import { ezDateOutBrand } from "./date-out-schema";
import { ezFileBrand, FileSchema } from "./file-schema";
import { metaSymbol } from "./metadata";
import { ProprietaryBrand } from "./proprietary-schemas";
import { ezRawBrand, RawSchema } from "./raw-schema";
import { HandlingRules, walkSchema } from "./schema-walker";
import {
  ensureTypeNode,
  isPrimitive,
  makeInterfaceProp,
  makeLiteralType,
} from "./typescript-api";
import { LiteralType, Producer, ZTSContext } from "./zts-helpers";

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

const onLiteral: Producer = ({ value }: z.ZodLiteral<LiteralType>) =>
  makeLiteralType(value);

const onObject: Producer = (
  { shape }: z.ZodObject<z.ZodRawShape>,
  {
    isResponse,
    next,
    optionalPropStyle: { withQuestionMark: hasQuestionMark },
  },
) => {
  const members = Object.entries(shape).map<ts.TypeElement>(([key, value]) => {
    const { description: comment, _def } = value as z.ZodType;
    const isOptional = isResponse
      ? value instanceof z.ZodOptional
      : value.isOptional();
    return makeInterfaceProp(key, next(value), {
      comment,
      isOptional: isOptional && hasQuestionMark,
      isDeprecated: _def[metaSymbol]?.isDeprecated,
    });
  });
  return f.createTypeLiteralNode(members);
};

const onArray: Producer = ({ element }: z.ZodArray<z.ZodTypeAny>, { next }) =>
  f.createArrayTypeNode(next(element));

const onEnum: Producer = ({ options }: z.ZodEnum<[string, ...string[]]>) =>
  f.createUnionTypeNode(options.map(makeLiteralType));

const onSomeUnion: Producer = (
  {
    options,
  }:
    | z.ZodUnion<z.ZodUnionOptions>
    | z.ZodDiscriminatedUnion<string, z.ZodDiscriminatedUnionOption<string>[]>,
  { next },
) => {
  const nodes = new Map<ts.TypeNode | ts.KeywordTypeSyntaxKind, ts.TypeNode>();
  for (const option of options) {
    const node = next(option);
    nodes.set(isPrimitive(node) ? node.kind : node, node);
  }
  return f.createUnionTypeNode(Array.from(nodes.values()));
};

const makeSample = (produced: ts.TypeNode) =>
  samples?.[produced.kind as keyof typeof samples];

const onEffects: Producer = (
  schema: z.ZodEffects<z.ZodTypeAny>,
  { next, isResponse },
) => {
  const input = next(schema.innerType());
  if (isResponse && schema._def.effect.type === "transform") {
    const outputType = getTransformedType(schema, makeSample(input));
    const resolutions: Partial<
      Record<NonNullable<typeof outputType>, ts.KeywordTypeSyntaxKind>
    > = {
      number: ts.SyntaxKind.NumberKeyword,
      bigint: ts.SyntaxKind.BigIntKeyword,
      boolean: ts.SyntaxKind.BooleanKeyword,
      string: ts.SyntaxKind.StringKeyword,
      undefined: ts.SyntaxKind.UndefinedKeyword,
      object: ts.SyntaxKind.ObjectKeyword,
    };
    return ensureTypeNode(
      (outputType && resolutions[outputType]) || ts.SyntaxKind.AnyKeyword,
    );
  }
  return input;
};

const onNativeEnum: Producer = (schema: z.ZodNativeEnum<z.EnumLike>) =>
  f.createUnionTypeNode(Object.values(schema.enum).map(makeLiteralType));

const onOptional: Producer = (
  schema: z.ZodOptional<z.ZodTypeAny>,
  { next, optionalPropStyle: { withUndefined: hasUndefined } },
) => {
  const actualTypeNode = next(schema.unwrap());
  return hasUndefined
    ? f.createUnionTypeNode([
        actualTypeNode,
        ensureTypeNode(ts.SyntaxKind.UndefinedKeyword),
      ])
    : actualTypeNode;
};

const onNullable: Producer = (schema: z.ZodNullable<z.ZodTypeAny>, { next }) =>
  f.createUnionTypeNode([next(schema.unwrap()), makeLiteralType(null)]);

const onTuple: Producer = (
  { items, _def: { rest } }: z.AnyZodTuple,
  { next },
) =>
  f.createTupleTypeNode(
    items
      .map(next)
      .concat(rest === null ? [] : f.createRestTypeNode(next(rest))),
  );

const onRecord: Producer = (
  { keySchema, valueSchema }: z.ZodRecord<z.ZodTypeAny>,
  { next },
) => ensureTypeNode("Record", [keySchema, valueSchema].map(next));

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
  { _def: { left, right } }: z.ZodIntersection<z.ZodTypeAny, z.ZodTypeAny>,
  { next },
) => intersect([left, right].map(next));

const onDefault: Producer = ({ _def }: z.ZodDefault<z.ZodTypeAny>, { next }) =>
  next(_def.innerType);

const onPrimitive =
  (syntaxKind: ts.KeywordTypeSyntaxKind): Producer =>
  () =>
    ensureTypeNode(syntaxKind);

const onBranded: Producer = (
  schema: z.ZodBranded<z.ZodTypeAny, string | number | symbol>,
  { next },
) => next(schema.unwrap());

const onReadonly: Producer = (schema: z.ZodReadonly<z.ZodTypeAny>, { next }) =>
  next(schema.unwrap());

const onCatch: Producer = ({ _def }: z.ZodCatch<z.ZodTypeAny>, { next }) =>
  next(_def.innerType);

const onPipeline: Producer = (
  { _def }: z.ZodPipeline<z.ZodTypeAny, z.ZodTypeAny>,
  { next, isResponse },
) => next(_def[isResponse ? "out" : "in"]);

const onNull: Producer = () => makeLiteralType(null);

const onLazy: Producer = (lazy: z.ZodLazy<z.ZodTypeAny>, { makeAlias, next }) =>
  makeAlias(lazy, () => next(lazy.schema));

const onFile: Producer = (schema: FileSchema) => {
  const subject = schema.unwrap();
  const stringType = ensureTypeNode(ts.SyntaxKind.StringKeyword);
  const bufferType = ensureTypeNode("Buffer");
  const unionType = f.createUnionTypeNode([stringType, bufferType]);
  return subject instanceof z.ZodString
    ? stringType
    : subject instanceof z.ZodUnion
      ? unionType
      : bufferType;
};

const onRaw: Producer = (schema: RawSchema, { next }) =>
  next(schema.unwrap().shape.raw);

const producers: HandlingRules<
  ts.TypeNode,
  ZTSContext,
  z.ZodFirstPartyTypeKind | ProprietaryBrand
> = {
  ZodString: onPrimitive(ts.SyntaxKind.StringKeyword),
  ZodNumber: onPrimitive(ts.SyntaxKind.NumberKeyword),
  ZodBigInt: onPrimitive(ts.SyntaxKind.BigIntKeyword),
  ZodBoolean: onPrimitive(ts.SyntaxKind.BooleanKeyword),
  ZodAny: onPrimitive(ts.SyntaxKind.AnyKeyword),
  ZodUndefined: onPrimitive(ts.SyntaxKind.UndefinedKeyword),
  [ezDateInBrand]: onPrimitive(ts.SyntaxKind.StringKeyword),
  [ezDateOutBrand]: onPrimitive(ts.SyntaxKind.StringKeyword),
  ZodNull: onNull,
  ZodArray: onArray,
  ZodTuple: onTuple,
  ZodRecord: onRecord,
  ZodObject: onObject,
  ZodLiteral: onLiteral,
  ZodIntersection: onIntersection,
  ZodUnion: onSomeUnion,
  ZodDefault: onDefault,
  ZodEnum: onEnum,
  ZodNativeEnum: onNativeEnum,
  ZodEffects: onEffects,
  ZodOptional: onOptional,
  ZodNullable: onNullable,
  ZodDiscriminatedUnion: onSomeUnion,
  ZodBranded: onBranded,
  ZodCatch: onCatch,
  ZodPipeline: onPipeline,
  ZodLazy: onLazy,
  ZodReadonly: onReadonly,
  [ezFileBrand]: onFile,
  [ezRawBrand]: onRaw,
};

export const zodToTs = (
  schema: z.ZodTypeAny,
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
