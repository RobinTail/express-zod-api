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
import { ZodTypeAny } from "zod";
import {
  GetType,
  GetTypeFunction,
  LiteralType,
  RequiredZodToTsOptions,
  ZodToTsOptions,
  ZodToTsReturn,
  ZodToTsStore,
} from "./zts-types";
import {
  addJsDocComment,
  createUnknownKeywordNode,
  ensureTypeNode,
  makePropertyIdentifier,
  makeTypeReference,
} from "./zts-utils";

const { factory: f } = ts;

const callGetType = (
  zod: ZodTypeAny & GetType,
  identifier: string,
  options: RequiredZodToTsOptions
) => {
  let type: ReturnType<GetTypeFunction> | null = null;

  // this must be called before accessing 'type'
  if (zod.getType) type = zod.getType(ts, identifier, options);
  return type;
};

export const resolveOptions = (
  raw?: ZodToTsOptions
): RequiredZodToTsOptions => {
  const resolved: RequiredZodToTsOptions = { resolveNativeEnums: true };
  return { ...resolved, ...raw };
};

const zodToTsNode = (
  zod: ZodTypeAny,
  identifier: string,
  store: ZodToTsStore,
  options: RequiredZodToTsOptions
): ts.TypeNode => {
  const { typeName } = zod._def;

  const getTypeType = callGetType(zod, identifier, options);
  // special case native enum, which needs an identifier node
  if (getTypeType && typeName !== "ZodNativeEnum") {
    return ensureTypeNode(getTypeType);
  }

  const otherArgs = [identifier, store, options] as const;

  switch (typeName) {
    case "ZodString":
      return f.createKeywordTypeNode(ts.SyntaxKind.StringKeyword);
    case "ZodNumber":
      return f.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword);
    case "ZodBigInt":
      return f.createKeywordTypeNode(ts.SyntaxKind.BigIntKeyword);
    case "ZodBoolean":
      return f.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword);
    case "ZodDate":
      return f.createTypeReferenceNode(f.createIdentifier("Date"));
    case "ZodUndefined":
      return f.createKeywordTypeNode(ts.SyntaxKind.UndefinedKeyword);
    case "ZodNull":
      return f.createLiteralTypeNode(f.createNull());
    case "ZodVoid":
      return f.createUnionTypeNode([
        f.createKeywordTypeNode(ts.SyntaxKind.VoidKeyword),
        f.createKeywordTypeNode(ts.SyntaxKind.UndefinedKeyword),
      ]);
    case "ZodAny":
      return f.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword);
    case "ZodUnknown":
      return createUnknownKeywordNode();
    case "ZodNever":
      return f.createKeywordTypeNode(ts.SyntaxKind.NeverKeyword);
    case "ZodLazy": {
      // it is impossible to determine what the lazy value is referring to
      // so we force the user to declare it
      if (!getTypeType) return makeTypeReference(identifier);
      break;
    }
    case "ZodLiteral": {
      // z.literal('hi') -> 'hi'
      let literal: ts.LiteralExpression | ts.BooleanLiteral;

      const literalValue = zod._def.value as LiteralType;
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
    }
    case "ZodObject": {
      const properties = Object.entries(zod._def.shape());

      const members: ts.TypeElement[] = properties.map(([key, value]) => {
        const nextZodNode = value as ZodTypeAny;
        const type = zodToTsNode(nextZodNode, ...otherArgs);

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
    }

    case "ZodArray": {
      const type = zodToTsNode(zod._def.type, ...otherArgs);
      return f.createArrayTypeNode(type);
    }

    case "ZodEnum": {
      // z.enum['a', 'b', 'c'] -> 'a' | 'b' | 'c
      const types = zod._def.values.map((value: string) =>
        f.createStringLiteral(value)
      );
      return f.createUnionTypeNode(types);
    }

    case "ZodUnion": {
      // z.union([z.string(), z.number()]) -> string | number
      const unionOptions: ZodTypeAny[] = zod._def.options;
      const types: ts.TypeNode[] = unionOptions.map((option) =>
        zodToTsNode(option, ...otherArgs)
      );
      return f.createUnionTypeNode(types);
    }

    case "ZodDiscriminatedUnion": {
      // z.discriminatedUnion('kind', [z.object({ kind: z.literal('a'), a: z.string() }), z.object({ kind: z.literal('b'), b: z.number() })]) -> { kind: 'a', a: string } | { kind: 'b', b: number }
      const unionOptions: ZodTypeAny[] = [...zod._def.options.values()];
      const types: ts.TypeNode[] = unionOptions.map((option) =>
        zodToTsNode(option, ...otherArgs)
      );
      return f.createUnionTypeNode(types);
    }

    case "ZodEffects": {
      // ignore any effects, they won't factor into the types
      return zodToTsNode(zod._def.schema, ...otherArgs);
    }

    case "ZodNativeEnum": {
      // z.nativeEnum(Fruits) -> Fruits
      // can resolve Fruits into store and user can handle enums
      let type = getTypeType;
      if (!type) return createUnknownKeywordNode();

      if (options.resolveNativeEnums) {
        const enumMembers = Object.entries(
          zod._def.values as Record<string, string | number>
        ).map(([key, value]) => {
          const literal =
            typeof value === "number"
              ? f.createNumericLiteral(value)
              : f.createStringLiteral(value);

          return f.createEnumMember(makePropertyIdentifier(key), literal);
        });

        if (ts.isIdentifier(type)) {
          store.nativeEnums.push(
            f.createEnumDeclaration(undefined, type, enumMembers)
          );
        } else {
          throw new Error(
            "getType on nativeEnum must return an identifier when resolveNativeEnums is set"
          );
        }
      }

      return ensureTypeNode(type);
    }

    case "ZodOptional": {
      const innerType = zodToTsNode(
        zod._def.innerType,
        ...otherArgs
      ) as ts.TypeNode;
      return f.createUnionTypeNode([
        innerType,
        f.createKeywordTypeNode(ts.SyntaxKind.UndefinedKeyword),
      ]);
    }

    case "ZodNullable": {
      const innerType = zodToTsNode(
        zod._def.innerType,
        ...otherArgs
      ) as ts.TypeNode;
      return f.createUnionTypeNode([
        innerType,
        f.createLiteralTypeNode(f.createNull()),
      ]);
    }

    case "ZodTuple": {
      // z.tuple([z.string(), z.number()]) -> [string, number]
      const types = zod._def.items.map((option: ZodTypeAny) =>
        zodToTsNode(option, ...otherArgs)
      );
      return f.createTupleTypeNode(types);
    }

    case "ZodRecord": {
      // z.record(z.number()) -> { [x: string]: number }
      const valueType = zodToTsNode(zod._def.valueType, ...otherArgs);

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
    }

    case "ZodMap": {
      // z.map(z.string()) -> Map<string>
      const valueType = zodToTsNode(zod._def.valueType, ...otherArgs);
      const keyType = zodToTsNode(zod._def.keyType, ...otherArgs);

      return f.createTypeReferenceNode(f.createIdentifier("Map"), [
        keyType,
        valueType,
      ]);
    }

    case "ZodSet": {
      // z.set(z.string()) -> Set<string>
      const type = zodToTsNode(zod._def.valueType, ...otherArgs);
      return f.createTypeReferenceNode(f.createIdentifier("Set"), [type]);
    }

    case "ZodIntersection": {
      // z.number().and(z.string()) -> number & string
      const left = zodToTsNode(zod._def.left, ...otherArgs);
      const right = zodToTsNode(zod._def.right, ...otherArgs);
      return f.createIntersectionTypeNode([left, right]);
    }

    case "ZodPromise": {
      // z.promise(z.string()) -> Promise<string>
      const type = zodToTsNode(zod._def.type, ...otherArgs);
      return f.createTypeReferenceNode(f.createIdentifier("Promise"), [type]);
    }

    case "ZodFunction": {
      // z.function().args(z.string()).returns(z.number()) -> (args_0: string) => number
      const argTypes = zod._def.args._def.items.map(
        (arg: ZodTypeAny, index: number) => {
          const argType = zodToTsNode(arg, ...otherArgs);

          return f.createParameterDeclaration(
            undefined,
            undefined,
            f.createIdentifier(`args_${index}`),
            undefined,
            argType,
            undefined
          );
        }
      ) as ts.ParameterDeclaration[];

      argTypes.push(
        f.createParameterDeclaration(
          undefined,
          f.createToken(ts.SyntaxKind.DotDotDotToken),
          f.createIdentifier(`args_${argTypes.length}`),
          undefined,
          f.createArrayTypeNode(createUnknownKeywordNode()),
          undefined
        )
      );

      const returnType = zodToTsNode(zod._def.returns, ...otherArgs);
      return f.createFunctionTypeNode(undefined, argTypes, returnType);
    }

    case "ZodDefault": {
      // z.string().optional().default('hi') -> string
      const type = zodToTsNode(zod._def.innerType, ...otherArgs) as ts.TypeNode;
      const filteredNodes: ts.Node[] = [];
      type.forEachChild((node) => {
        if (![ts.SyntaxKind.UndefinedKeyword].includes(node.kind)) {
          filteredNodes.push(node);
        }
      });

      // @ts-expect-error needed to set children
      type.types = filteredNodes;
      return type;
    }
  }

  return f.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword);
};

export const zodToTs = (
  zod: ZodTypeAny,
  identifier?: string,
  options?: ZodToTsOptions
): ZodToTsReturn => {
  const resolvedIdentifier = identifier ?? "Identifier";
  const resolvedOptions = resolveOptions(options);
  const store: ZodToTsStore = { nativeEnums: [] };
  const node = zodToTsNode(zod, resolvedIdentifier, store, resolvedOptions);
  return { node, store };
};
