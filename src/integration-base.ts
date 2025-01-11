import ts from "typescript";
import {
  f,
  makeConst,
  makeKeyOf,
  makeParams,
  makePromise,
  makeSomeOfHelper,
  makeType,
  recordStringAny,
} from "./typescript-api";

export abstract class IntegrationBase {
  protected ids = {
    pathType: f.createIdentifier("Path"),
    methodType: f.createIdentifier("Method"),
    requestType: f.createIdentifier("Request"),
    inputInterface: f.createIdentifier("Input"),
    posResponseInterface: f.createIdentifier("PositiveResponse"),
    negResponseInterface: f.createIdentifier("NegativeResponse"),
    encResponseInterface: f.createIdentifier("EncodedResponse"),
    responseInterface: f.createIdentifier("Response"),
    endpointTagsConst: f.createIdentifier("endpointTags"),
    implementationType: f.createIdentifier("Implementation"),
    clientClass: f.createIdentifier("ExpressZodAPIClient"),
    keyParameter: f.createIdentifier("key"),
    pathParameter: f.createIdentifier("path"),
    paramsArgument: f.createIdentifier("params"),
    methodParameter: f.createIdentifier("method"),
    requestParameter: f.createIdentifier("request"),
    accumulator: f.createIdentifier("acc"),
    provideMethod: f.createIdentifier("provide"),
    implementationArgument: f.createIdentifier("implementation"),
    headersProperty: f.createIdentifier("headers"),
    hasBodyConst: f.createIdentifier("hasBody"),
    undefinedValue: f.createIdentifier("undefined"),
    bodyProperty: f.createIdentifier("body"),
    responseConst: f.createIdentifier("response"),
    searchParamsConst: f.createIdentifier("searchParams"),
    exampleImplementationConst: f.createIdentifier("exampleImplementation"),
    clientConst: f.createIdentifier("client"),
    contentTypeConst: f.createIdentifier("contentType"),
    isJsonConst: f.createIdentifier("isJSON"),
  } satisfies Record<string, ts.Identifier>;

  protected someOfType = makeSomeOfHelper();

  // export type Request = keyof Input;
  protected requestType = makeType(
    this.ids.requestType,
    makeKeyOf(this.ids.inputInterface),
    { expose: true },
  );

  /** @example SomeOf<_>*/
  protected someOf = ({ name }: ts.TypeAliasDeclaration) =>
    f.createTypeReferenceNode(this.someOfType.name, [
      f.createTypeReferenceNode(name),
    ]);

  // export const endpointTags = { "get /v1/user/retrieve": ["users"] }
  protected makeEndpointTagsConst = (endpointTags: ts.PropertyAssignment[]) =>
    makeConst(
      this.ids.endpointTagsConst,
      f.createObjectLiteralExpression(endpointTags),
      { expose: true },
    );

  // export type Implementation = (method: Method, path: string, params: Record<string, any>) => Promise<any>;
  protected makeImplementationType = () =>
    makeType(
      this.ids.implementationType,
      f.createFunctionTypeNode(
        undefined,
        makeParams({
          [this.ids.methodParameter.text]: f.createTypeReferenceNode(
            this.ids.methodType,
          ),
          [this.ids.pathParameter.text]: f.createKeywordTypeNode(
            ts.SyntaxKind.StringKeyword,
          ),
          [this.ids.paramsArgument.text]: recordStringAny,
        }),
        makePromise("any"),
      ),
      { expose: true },
    );
}
