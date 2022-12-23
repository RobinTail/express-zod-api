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
import { walkSchema } from "./schema-walker";
import {
  LiteralType,
  Producer,
  ZTSContext,
  addJsDocComment,
  makePropertyIdentifier,
} from "./zts-helpers";

const { factory: f } = ts;

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
      : f.createStringLiteral(value)
  );

// @todo align treating optionals
const onObject: Producer<z.ZodObject<z.ZodRawShape>> = ({
  schema: { shape },
  next,
}) => {
  const members = Object.entries(shape).map<ts.TypeElement>(([key, value]) => {
    const { typeName: propTypeName } = value._def;
    const isOptional = propTypeName === "ZodOptional" || value.isOptional();
    const propertySignature = f.createPropertySignature(
      undefined,
      makePropertyIdentifier(key),
      isOptional ? f.createToken(ts.SyntaxKind.QuestionToken) : undefined,
      next({ schema: value })
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
      f.createLiteralTypeNode(f.createStringLiteral(option))
    )
  );

const onSomeUnion: Producer<
  | z.ZodUnion<[z.ZodTypeAny, ...z.ZodTypeAny[]]>
  | z.ZodDiscriminatedUnion<string, z.ZodObject<z.ZodRawShape>[]>
> = ({ schema: { options }, next }) =>
  f.createUnionTypeNode(options.map((option) => next({ schema: option })));

// @todo implement effects handling
const onEffects: Producer<z.ZodEffects<any>> = ({ schema, next }) =>
  next({ schema: schema._def.schema });

const onNativeEnum: Producer<z.ZodNativeEnum<z.EnumLike>> = ({ schema }) =>
  f.createUnionTypeNode(
    Object.values(schema.enum).map((value) =>
      f.createLiteralTypeNode(
        typeof value === "number"
          ? f.createNumericLiteral(value)
          : f.createStringLiteral(value)
      )
    )
  );

const onOptional: Producer<z.ZodOptional<z.ZodTypeAny>> = ({ next, schema }) =>
  f.createUnionTypeNode([
    next({ schema: schema.unwrap() }),
    f.createKeywordTypeNode(ts.SyntaxKind.UndefinedKeyword),
  ]);

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
      next({ schema: entry })
    )
  );

const onDefault: Producer<z.ZodDefault<z.ZodTypeAny>> = ({ next, schema }) =>
  next({ schema: schema._def.innerType });

export const zodToTs = ({
  schema,
  ...context
}: {
  schema: z.ZodTypeAny;
} & ZTSContext): ts.TypeNode => {
  return walkSchema<ts.TypeNode, ZTSContext>({
    schema,
    rules: {
      ZodDateIn: () =>
        ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
      ZodDateOut: () =>
        ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
      ZodString: () => f.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
      ZodNumber: () => f.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword),
      ZodBigInt: () => f.createKeywordTypeNode(ts.SyntaxKind.BigIntKeyword),
      ZodBoolean: () => f.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword),
      ZodDate: () => f.createTypeReferenceNode(f.createIdentifier("Date")),
      ZodUndefined: () =>
        f.createKeywordTypeNode(ts.SyntaxKind.UndefinedKeyword),
      ZodNull: () => f.createLiteralTypeNode(f.createNull()),
      ZodAny: () => f.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
      ZodLiteral: onLiteral,
      ZodObject: onObject,
      ZodArray: onArray,
      ZodEnum: onEnum,
      ZodUnion: onSomeUnion,
      ZodDiscriminatedUnion: onSomeUnion,
      ZodEffects: onEffects,
      ZodNativeEnum: onNativeEnum,
      ZodOptional: onOptional,
      ZodNullable: onNullable,
      ZodTuple: onTuple,
      ZodRecord: onRecord,
      ZodIntersection: onIntersection,
      ZodDefault: onDefault,
    },
    onMissing: () => f.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
    ...context,
  });
};
