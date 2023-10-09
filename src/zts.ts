/**
 * This file is based on https://github.com/sachinraja/zod-to-ts
 *
 * MIT License
 *
 * Copyright (c) 2021 Sachin Raja
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import ts from "typescript";
import { z } from "zod";
import { hasCoercion, tryToTransform } from "./common-helpers";
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

const onLiteral: Producer<z.ZodLiteral<LiteralType>> = ({
  schema: { value },
}) =>
  f.createLiteralTypeNode(
    typeof value === "number"
      ? f.createNumericLiteral(value)
      : typeof value === "boolean"
      ? value
        ? f.createTrue()
        : f.createFalse()
      : f.createStringLiteral(value),
  );

const onObject: Producer<z.ZodObject<z.ZodRawShape>> = ({
  schema: { shape },
  isResponse,
  next,
  optionalPropStyle: { withQuestionMark: hasQuestionMark },
}) => {
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
      next({ schema: value }),
    );
    if (value.description) {
      addJsDocComment(propertySignature, value.description);
    }
    return propertySignature;
  });
  return f.createTypeLiteralNode(members);
};

const onArray: Producer<z.ZodArray<z.ZodTypeAny>> = ({
  schema: { element },
  next,
}) => f.createArrayTypeNode(next({ schema: element }));

const onEnum: Producer<z.ZodEnum<[string, ...string[]]>> = ({
  schema: { options },
}) =>
  f.createUnionTypeNode(
    options.map((option) =>
      f.createLiteralTypeNode(f.createStringLiteral(option)),
    ),
  );

const onSomeUnion: Producer<
  | z.ZodUnion<z.ZodUnionOptions>
  | z.ZodDiscriminatedUnion<string, z.ZodDiscriminatedUnionOption<string>[]>
> = ({ schema: { options }, next }) =>
  f.createUnionTypeNode(options.map((option) => next({ schema: option })));

const makeSample = (produced: ts.TypeNode) =>
  samples?.[produced.kind as keyof typeof samples];

const onEffects: Producer<z.ZodEffects<z.ZodTypeAny>> = ({
  schema,
  next,
  isResponse,
}) => {
  const input = next({ schema: schema.innerType() });
  const effect = schema._def.effect;
  if (isResponse && effect.type === "transform") {
    const outputType = tryToTransform({ effect, sample: makeSample(input) });
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

const onNativeEnum: Producer<z.ZodNativeEnum<z.EnumLike>> = ({ schema }) =>
  f.createUnionTypeNode(
    Object.values(schema.enum).map((value) =>
      f.createLiteralTypeNode(
        typeof value === "number"
          ? f.createNumericLiteral(value)
          : f.createStringLiteral(value),
      ),
    ),
  );

const onOptional: Producer<z.ZodOptional<z.ZodTypeAny>> = ({
  next,
  schema,
  optionalPropStyle: { withUndefined: hasUndefined },
}) => {
  const actualTypeNode = next({ schema: schema.unwrap() });
  return hasUndefined
    ? f.createUnionTypeNode([
        actualTypeNode,
        f.createKeywordTypeNode(ts.SyntaxKind.UndefinedKeyword),
      ])
    : actualTypeNode;
};

const onNullable: Producer<z.ZodNullable<z.ZodTypeAny>> = ({ next, schema }) =>
  f.createUnionTypeNode([
    next({ schema: schema.unwrap() }),
    f.createLiteralTypeNode(f.createNull()),
  ]);

const onTuple: Producer<z.ZodTuple> = ({ next, schema: { items } }) =>
  f.createTupleTypeNode(items.map((option) => next({ schema: option })));

const onRecord: Producer<z.ZodRecord> = ({
  next,
  schema: { keySchema, valueSchema },
}) =>
  f.createExpressionWithTypeArguments(f.createIdentifier("Record"), [
    next({ schema: keySchema }),
    next({ schema: valueSchema }),
  ]);

const onIntersection: Producer<
  z.ZodIntersection<z.ZodTypeAny, z.ZodTypeAny>
> = ({ next, schema }) =>
  f.createIntersectionTypeNode(
    [schema._def.left, schema._def.right].map((entry) =>
      next({ schema: entry }),
    ),
  );

const onDefault: Producer<z.ZodDefault<z.ZodTypeAny>> = ({ next, schema }) =>
  next({ schema: schema._def.innerType });

const onPrimitive =
  (syntaxKind: ts.KeywordTypeSyntaxKind): Producer<z.ZodTypeAny> =>
  () =>
    f.createKeywordTypeNode(syntaxKind);

const onBranded: Producer<
  z.ZodBranded<z.ZodTypeAny, string | number | symbol>
> = ({ next, schema }) => next({ schema: schema.unwrap() });

const onReadonly: Producer<z.ZodReadonly<z.ZodTypeAny>> = ({ next, schema }) =>
  next({ schema: schema._def.innerType });

const onCatch: Producer<z.ZodCatch<z.ZodTypeAny>> = ({ next, schema }) =>
  next({ schema: schema._def.innerType });

const onPipeline: Producer<z.ZodPipeline<z.ZodTypeAny, z.ZodTypeAny>> = ({
  schema,
  next,
  isResponse,
}) => next({ schema: schema._def[isResponse ? "out" : "in"] });

const onNull: Producer<z.ZodNull> = () =>
  f.createLiteralTypeNode(f.createNull());

const onLazy: Producer<z.ZodLazy<z.ZodTypeAny>> = ({
  getAlias,
  makeAlias,
  next,
  serializer: serialize,
  schema: lazy,
}) => {
  const name = `Type${serialize(lazy.schema)}`;
  return (
    getAlias(name) ||
    (() => {
      makeAlias(name, f.createLiteralTypeNode(f.createNull())); // make empty type first
      return makeAlias(name, next({ schema: lazy.schema })); // update
    })()
  );
};

const producers: HandlingRules<ts.TypeNode, ZTSContext> = {
  ZodString: onPrimitive(ts.SyntaxKind.StringKeyword),
  ZodNumber: onPrimitive(ts.SyntaxKind.NumberKeyword),
  ZodBigInt: onPrimitive(ts.SyntaxKind.BigIntKeyword),
  ZodBoolean: onPrimitive(ts.SyntaxKind.BooleanKeyword),
  ZodDateIn: onPrimitive(ts.SyntaxKind.StringKeyword),
  ZodDateOut: onPrimitive(ts.SyntaxKind.StringKeyword),
  ZodNull: onNull,
  ZodArray: onArray,
  ZodTuple: onTuple,
  ZodRecord: onRecord,
  ZodObject: onObject,
  ZodLiteral: onLiteral,
  ZodIntersection: onIntersection,
  ZodUnion: onSomeUnion,
  ZodFile: onPrimitive(ts.SyntaxKind.StringKeyword),
  ZodAny: onPrimitive(ts.SyntaxKind.AnyKeyword),
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
};

export const zodToTs = ({
  schema,
  ...ctx
}: {
  schema: z.ZodTypeAny;
} & ZTSContext) =>
  walkSchema<ts.TypeNode, ZTSContext>({
    schema,
    rules: producers,
    onMissing: () => f.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
    ...ctx,
  });
