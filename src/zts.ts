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
import { LiteralType, Producer, ZTSContext, ZTSOptions } from "./zts-types";
import { addJsDocComment, makePropertyIdentifier } from "./zts-utils";

const { factory: f } = ts;

const onLiteral: Producer<z.ZodLiteral<LiteralType>> = ({ schema }) => {
  // z.literal('hi') -> 'hi'
  let literal: ts.LiteralExpression | ts.BooleanLiteral;
  const literalValue = schema._def.value;
  switch (typeof literalValue) {
    case "number":
      literal = f.createNumericLiteral(literalValue);
      break;
    case "boolean":
      if (literalValue) literal = f.createTrue();
      else literal = f.createFalse();
      break;
    default:
      literal = f.createStringLiteral(literalValue);
      break;
  }
  return f.createLiteralTypeNode(literal);
};

const onObject: Producer<z.ZodObject<z.ZodRawShape>> = ({ schema, next }) => {
  const properties = Object.entries(schema._def.shape());
  const members: ts.TypeElement[] = properties.map(([key, value]) => {
    const nextZodNode = value;
    const type = next({ schema: nextZodNode });
    const { typeName: nextZodNodeTypeName } = nextZodNode._def;
    const isOptional =
      nextZodNodeTypeName === "ZodOptional" || nextZodNode.isOptional();
    const propertySignature = f.createPropertySignature(
      undefined,
      makePropertyIdentifier(key),
      isOptional ? f.createToken(ts.SyntaxKind.QuestionToken) : undefined,
      type
    );
    if (nextZodNode.description) {
      addJsDocComment(propertySignature, nextZodNode.description);
    }
    return propertySignature;
  });
  return f.createTypeLiteralNode(members);
};

const onArray: Producer<z.ZodArray<z.ZodTypeAny>> = ({ schema, next }) => {
  const type = next({ schema: schema._def.type });
  return f.createArrayTypeNode(type);
};

const onEnum: Producer<z.ZodEnum<[string, ...string[]]>> = ({ schema }) => {
  // z.enum['a', 'b', 'c'] -> 'a' | 'b' | 'c
  const types = schema._def.values.map(
    (value) => f.createLiteralTypeNode(f.createStringLiteral(value)) // fixed by Robin
  );
  return f.createUnionTypeNode(types);
};

const onUnion: Producer<z.ZodUnion<[z.ZodTypeAny, ...z.ZodTypeAny[]]>> = ({
  schema,
  next,
}) => {
  // z.union([z.string(), z.number()]) -> string | number
  const types = schema._def.options.map((option) => next({ schema: option }));
  return f.createUnionTypeNode(types);
};

const onDiscriminatedUnion: Producer<
  z.ZodDiscriminatedUnion<string, z.ZodObject<z.ZodRawShape>[]>
> = ({ schema, next }) => {
  // z.discriminatedUnion('kind', [z.object({ kind: z.literal('a'), a: z.string() }), z.object({ kind: z.literal('b'), b: z.number() })]) -> { kind: 'a', a: string } | { kind: 'b', b: number }
  const unionOptions = [...schema._def.options.values()];
  const types = unionOptions.map((option) => next({ schema: option }));
  return f.createUnionTypeNode(types);
};

const onEffects: Producer<z.ZodEffects<any>> = ({ schema, next }) => {
  // ignore any effects, they won't factor into the types
  return next({ schema: schema._def.schema });
};

const onNativeEnum: Producer<z.ZodNativeEnum<z.EnumLike>> = ({ schema }) => {
  const types = Object.values(schema._def.values).map((value) =>
    f.createLiteralTypeNode(
      typeof value === "number"
        ? f.createNumericLiteral(value)
        : f.createStringLiteral(value)
    )
  );
  return f.createUnionTypeNode(types);
};

const onOptional: Producer<z.ZodOptional<z.ZodTypeAny>> = ({
  next,
  schema,
}) => {
  const innerType = next({ schema: schema._def.innerType });
  return f.createUnionTypeNode([
    innerType,
    f.createKeywordTypeNode(ts.SyntaxKind.UndefinedKeyword),
  ]);
};

const onNullable: Producer<z.ZodNullable<z.ZodTypeAny>> = ({
  next,
  schema,
}) => {
  const innerType = next({ schema: schema._def.innerType });
  return f.createUnionTypeNode([
    innerType,
    f.createLiteralTypeNode(f.createNull()),
  ]);
};

const onTuple: Producer<z.ZodTuple> = ({ next, schema }) => {
  // z.tuple([z.string(), z.number()]) -> [string, number]
  const types = schema._def.items.map((option) => next({ schema: option }));
  return f.createTupleTypeNode(types);
};

const onRecord: Producer<z.ZodRecord> = ({ next, schema }) => {
  // z.record(z.number()) -> { [x: string]: number }
  const valueType = next({ schema: schema._def.valueType });
  return f.createTypeLiteralNode([
    f.createIndexSignature(
      undefined,
      [
        f.createParameterDeclaration(
          undefined,
          undefined,
          f.createIdentifier("x"),
          undefined,
          f.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
          undefined
        ),
      ],
      valueType
    ),
  ]);
};

const onIntersection: Producer<
  z.ZodIntersection<z.ZodTypeAny, z.ZodTypeAny>
> = ({ next, schema }) => {
  // z.number().and(z.string()) -> number & string
  const left = next({ schema: schema._def.left });
  const right = next({ schema: schema._def.right });
  return f.createIntersectionTypeNode([left, right]);
};

const onDefault: Producer<z.ZodDefault<z.ZodTypeAny>> = ({ next, schema }) => {
  // z.string().optional().default('hi') -> string
  return next({ schema: schema._def.innerType }); // fixed by Robin
};

export const zodToTs = ({
  schema,
  identifier,
  ...options
}: {
  schema: z.ZodTypeAny;
  identifier?: string;
} & ZTSOptions): ts.TypeNode => {
  return walkSchema<ts.TypeNode, ZTSContext>({
    schema,
    identifier: identifier || "Identifier",
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
      ZodUnion: onUnion,
      ZodDiscriminatedUnion: onDiscriminatedUnion,
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
    ...options,
  });
};
