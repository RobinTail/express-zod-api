import ts from "typescript";

export const f = ts.factory;

export const exportModifier = [f.createModifier(ts.SyntaxKind.ExportKeyword)];

export const protectedReadonlyModifier = [
  f.createModifier(ts.SyntaxKind.ProtectedKeyword),
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

export const makeParam = ({
  name,
  type,
  mod,
}: {
  name: string;
  type: ts.TypeNode;
  mod?: ts.Modifier[];
}) =>
  f.createParameterDeclaration(
    undefined,
    mod,
    undefined,
    name,
    undefined,
    type
  );

export const makeRecord = (
  key: ts.Identifier,
  value: ts.KeywordTypeSyntaxKind
) =>
  f.createExpressionWithTypeArguments(f.createIdentifier("Record"), [
    f.createTypeReferenceNode(key),
    f.createKeywordTypeNode(value),
  ]);

export const makeEmptyConstructor = (params: ts.ParameterDeclaration[]) =>
  f.createConstructorDeclaration(
    undefined,
    undefined,
    params,
    f.createBlock([])
  );

export const makeQuotedProp = (name: string, ref: string) =>
  f.createPropertySignature(
    undefined,
    `"${name}"`,
    undefined,
    f.createTypeReferenceNode(ref)
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
