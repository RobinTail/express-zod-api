import ts from "typescript";
import { z } from "zod";
import { hasCoercion, tryToTransform } from "./common-helpers";
import { ezDateInBrand } from "./date-in-schema";
import { ezDateOutBrand } from "./date-out-schema";
import { FileSchema, ezFileBrand } from "./file-schema";
import { ProprietaryBrand } from "./proprietary-schemas";
import { RawSchema, ezRawBrand } from "./raw-schema";
import { HandlingRules, walkSchema } from "./schema-walker";
import {
  LiteralType,
  Producer,
  ZTSContext,
  addJsDocComment,
  makePropertyIdentifier,
} from "./zts-helpers";

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

const onLiteral: Producer = ({ value }: z.ZodLiteral<LiteralType>) =>
  f.createLiteralTypeNode(
    typeof value === "number"
      ? f.createNumericLiteral(value)
      : typeof value === "boolean"
        ? value
          ? f.createTrue()
          : f.createFalse()
        : f.createStringLiteral(value),
  );

const onObject: Producer = (
  { shape }: z.ZodObject<z.ZodRawShape>,
  {
    isResponse,
    next,
    optionalPropStyle: { withQuestionMark: hasQuestionMark },
  },
) => {
  const members = Object.entries(shape).map<ts.TypeElement>(([key, value]) => {
    const isOptional =
      isResponse && hasCoercion(value)
        ? value instanceof z.ZodOptional
        : value.isOptional();
    const propertySignature = f.createPropertySignature(
      undefined,
      makePropertyIdentifier(key),
      isOptional && hasQuestionMark
        ? f.createToken(ts.SyntaxKind.QuestionToken)
        : undefined,
      next(value),
    );
    if (value.description) {
      addJsDocComment(propertySignature, value.description);
    }
    return propertySignature;
  });
  return f.createTypeLiteralNode(members);
};

const onArray: Producer = ({ element }: z.ZodArray<z.ZodTypeAny>, { next }) =>
  f.createArrayTypeNode(next(element));

const onEnum: Producer = ({ options }: z.ZodEnum<[string, ...string[]]>) =>
  f.createUnionTypeNode(
    options.map((option) =>
      f.createLiteralTypeNode(f.createStringLiteral(option)),
    ),
  );

const onSomeUnion: Producer = (
  {
    options,
  }:
    | z.ZodUnion<z.ZodUnionOptions>
    | z.ZodDiscriminatedUnion<string, z.ZodDiscriminatedUnionOption<string>[]>,
  { next },
) => f.createUnionTypeNode(options.map(next));

const makeSample = (produced: ts.TypeNode) =>
  samples?.[produced.kind as keyof typeof samples];

const onEffects: Producer = (
  schema: z.ZodEffects<z.ZodTypeAny>,
  { next, isResponse },
) => {
  const input = next(schema.innerType());
  if (isResponse && schema._def.effect.type === "transform") {
    const outputType = tryToTransform(schema, makeSample(input));
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
    return f.createKeywordTypeNode(
      (outputType && resolutions[outputType]) || ts.SyntaxKind.AnyKeyword,
    );
  }
  return input;
};

const onNativeEnum: Producer = (schema: z.ZodNativeEnum<z.EnumLike>) =>
  f.createUnionTypeNode(
    Object.values(schema.enum).map((value) =>
      f.createLiteralTypeNode(
        typeof value === "number"
          ? f.createNumericLiteral(value)
          : f.createStringLiteral(value),
      ),
    ),
  );

const onOptional: Producer = (
  schema: z.ZodOptional<z.ZodTypeAny>,
  { next, optionalPropStyle: { withUndefined: hasUndefined } },
) => {
  const actualTypeNode = next(schema.unwrap());
  return hasUndefined
    ? f.createUnionTypeNode([
        actualTypeNode,
        f.createKeywordTypeNode(ts.SyntaxKind.UndefinedKeyword),
      ])
    : actualTypeNode;
};

const onNullable: Producer = (schema: z.ZodNullable<z.ZodTypeAny>, { next }) =>
  f.createUnionTypeNode([
    next(schema.unwrap()),
    f.createLiteralTypeNode(f.createNull()),
  ]);

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
) =>
  f.createExpressionWithTypeArguments(
    f.createIdentifier("Record"),
    [keySchema, valueSchema].map(next),
  );

const onIntersection: Producer = (
  { _def }: z.ZodIntersection<z.ZodTypeAny, z.ZodTypeAny>,
  { next },
) => f.createIntersectionTypeNode([_def.left, _def.right].map(next));

const onDefault: Producer = ({ _def }: z.ZodDefault<z.ZodTypeAny>, { next }) =>
  next(_def.innerType);

const onPrimitive =
  (syntaxKind: ts.KeywordTypeSyntaxKind): Producer =>
  () =>
    f.createKeywordTypeNode(syntaxKind);

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

const onNull: Producer = () => f.createLiteralTypeNode(f.createNull());

const onLazy: Producer = (lazy: z.ZodLazy<z.ZodTypeAny>, { makeAlias, next }) =>
  makeAlias(lazy, () => next(lazy.schema));

const onFile: Producer = (schema: FileSchema) => {
  const subject = schema.unwrap();
  const stringType = f.createKeywordTypeNode(ts.SyntaxKind.StringKeyword);
  const bufferType = f.createTypeReferenceNode("Buffer");
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
    onMissing: () => f.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
    ctx,
  });
