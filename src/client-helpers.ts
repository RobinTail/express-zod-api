import ts from "typescript";

export const f = ts.factory;

export const exportModifier = [f.createModifier(ts.SyntaxKind.ExportKeyword)];

export const publicReadonlyModifier = [
  f.createModifier(ts.SyntaxKind.PublicKeyword),
  f.createModifier(ts.SyntaxKind.ReadonlyKeyword),
];

const emptyPrefix = f.createTemplateHead("");

const emptyEnding = f.createTemplateTail("");

const spacingSuffix = f.createTemplateMiddle(" ");

export const makeTemplate = (names: (ts.Identifier | string)[]) =>
  f.createTemplateLiteralType(
    emptyPrefix,
    names.map((name, index) =>
      f.createTemplateLiteralTypeSpan(
        f.createTypeReferenceNode(name),
        index === names.length - 1 ? emptyEnding : spacingSuffix
      )
    )
  );

export const parametricIndexNode = makeTemplate(["M", "P"]);

export const makeParam = (
  name: string,
  type: ts.TypeNode,
  mod?: ts.Modifier[]
) =>
  f.createParameterDeclaration(
    undefined,
    mod,
    undefined,
    name,
    undefined,
    type
  );

export const makeParams = (
  params: Record<string, ts.TypeNode>,
  mod?: ts.Modifier[]
) =>
  Object.keys(params).reduce(
    (acc, name) => acc.concat(makeParam(name, params[name], mod)),
    [] as ts.ParameterDeclaration[]
  );

export const makeRecord = (
  key: ts.Identifier,
  value: ts.KeywordTypeSyntaxKind
) =>
  f.createExpressionWithTypeArguments(f.createIdentifier("Record"), [
    f.createTypeReferenceNode(key),
    f.createKeywordTypeNode(value),
  ]);

export const makeInitializingConstructor = (
  params: ts.ParameterDeclaration[],
  statements: ts.Statement[]
) =>
  f.createConstructorDeclaration(
    undefined,
    undefined,
    params,
    f.createBlock(statements, true)
  );

export const makeQuotedProp = (name: string, ref: string) =>
  f.createPropertySignature(
    undefined,
    `"${name}"`,
    undefined,
    f.createTypeReferenceNode(ref)
  );

export const makeConst = (name: string, value: ts.Expression) =>
  f.createVariableDeclarationList(
    [f.createVariableDeclaration(name, undefined, undefined, value)],
    ts.NodeFlags.Const
  );

export const makePublicLiteralType = (name: string, literals: string[]) =>
  f.createTypeAliasDeclaration(
    undefined,
    exportModifier,
    name,
    undefined,
    f.createUnionTypeNode(
      literals.map((option) =>
        f.createLiteralTypeNode(f.createStringLiteral(option))
      )
    )
  );

export const makePublicType = (name: string, value: ts.TypeNode) =>
  f.createTypeAliasDeclaration(
    undefined,
    exportModifier,
    name,
    undefined,
    value
  );

export const makePublicReadonlyEmptyProp = (name: string, type: ts.TypeNode) =>
  f.createPropertyDeclaration(
    undefined,
    publicReadonlyModifier,
    name,
    undefined,
    type,
    undefined
  );

export const makePublicClass = (
  name: string,
  constructor: ts.ConstructorDeclaration,
  props: ts.PropertyDeclaration[] = []
) =>
  f.createClassDeclaration(
    undefined,
    exportModifier,
    name,
    undefined,
    undefined,
    [constructor, ...props]
  );

export const makeIndexedPromise = (type: ts.Identifier, index: ts.TypeNode) =>
  f.createTypeReferenceNode("Promise", [
    f.createIndexedAccessTypeNode(f.createTypeReferenceNode(type), index),
  ]);

export const makePublicExtendedInterface = (
  name: string,
  extender: ts.HeritageClause[],
  props: ts.PropertySignature[]
) =>
  f.createInterfaceDeclaration(
    undefined,
    exportModifier,
    name,
    undefined,
    extender,
    props
  );

export const makeTypeParams = (params: Record<string, ts.Identifier>) =>
  Object.keys(params).reduce(
    (acc, name) =>
      acc.concat(
        f.createTypeParameterDeclaration(
          name,
          f.createTypeReferenceNode(params[name])
        )
      ),
    [] as ts.TypeParameterDeclaration[]
  );

export const cleanId = (path: string, method: string, suffix: string) => {
  return [method]
    .concat(path.split("/"))
    .concat(suffix)
    .map((entry) => entry.replace(/[^A-Z0-9]/i, ""))
    .map(
      (entry) => entry.slice(0, 1).toUpperCase() + entry.slice(1).toLowerCase()
    )
    .join("");
};
