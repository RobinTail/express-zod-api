import ts from "typescript";
import {
  f,
  makeAnd,
  makeConst,
  makeDeconstruction,
  makeEmptyInitializingConstructor,
  makeKeyOf,
  makeObjectKeysReducer,
  makeParam,
  makeParams,
  makePromise,
  makePropCall,
  makePublicClass,
  makePublicMethod,
  makeSomeOfHelper,
  makeTemplate,
  makeType,
  propOf,
  protectedReadonlyModifier,
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

  private makeProvider = () => {
    // `:${key}`
    const keyParamExpression = makeTemplate(":", [this.ids.keyParameter]);

    // Object.keys(params).reduce((acc, key) => acc.replace(___, params[key]), path)
    const pathArgument = makeObjectKeysReducer(
      this.ids.paramsArgument,
      makePropCall(this.ids.accumulator, propOf<string>("replace"), [
        keyParamExpression,
        f.createElementAccessExpression(
          f.createAsExpression(this.ids.paramsArgument, recordStringAny),
          this.ids.keyParameter,
        ),
      ]),
      this.ids.pathParameter,
    );

    // Object.keys(params).reduce((acc, key) =>
    //   Object.assign(acc, !path.includes(`:${key}`) && {[key]: params[key]} ), {})
    const paramsArgument = makeObjectKeysReducer(
      this.ids.paramsArgument,
      makePropCall(
        f.createIdentifier(Object.name),
        propOf<typeof Object>("assign"),
        [
          this.ids.accumulator,
          makeAnd(
            f.createPrefixUnaryExpression(
              ts.SyntaxKind.ExclamationToken,
              makePropCall(this.ids.pathParameter, propOf<string>("includes"), [
                keyParamExpression,
              ]),
            ),
            f.createObjectLiteralExpression(
              [
                f.createPropertyAssignment(
                  f.createComputedPropertyName(this.ids.keyParameter),
                  f.createElementAccessExpression(
                    f.createAsExpression(
                      this.ids.paramsArgument,
                      recordStringAny,
                    ),
                    this.ids.keyParameter,
                  ),
                ),
              ],
              false,
            ),
          ),
        ],
      ),
      f.createObjectLiteralExpression(),
    );

    // public provide<K extends MethodPath>(request: K, params: Input[K]): Promise<Response[K]> {
    return makePublicMethod(
      this.ids.provideMethod,
      makeParams({
        [this.ids.requestParameter.text]: f.createTypeReferenceNode("K"),
        [this.ids.paramsArgument.text]: f.createIndexedAccessTypeNode(
          f.createTypeReferenceNode(this.ids.inputInterface),
          f.createTypeReferenceNode("K"),
        ),
      }),
      f.createBlock([
        makeConst(
          // const [method, path, params] =
          makeDeconstruction(this.ids.methodParameter, this.ids.pathParameter),
          // request.split(/ (.+)/, 2) as [Method, Path];
          f.createAsExpression(
            makePropCall(this.ids.requestParameter, propOf<string>("split"), [
              f.createRegularExpressionLiteral("/ (.+)/"), // split once
              f.createNumericLiteral(2), // excludes third empty element
            ]),
            f.createTupleTypeNode([
              f.createTypeReferenceNode(this.ids.methodType),
              f.createTypeReferenceNode(this.ids.pathType),
            ]),
          ),
        ),
        // return this.implementation(___)
        f.createReturnStatement(
          makePropCall(f.createThis(), this.ids.implementationArgument, [
            this.ids.methodParameter,
            pathArgument,
            paramsArgument,
          ]),
        ),
      ]),
      {
        typeParams: { K: this.ids.requestType },
        returns: makePromise(
          f.createIndexedAccessTypeNode(
            f.createTypeReferenceNode(this.ids.responseInterface),
            f.createTypeReferenceNode("K"),
          ),
        ),
      },
    );
  };

  // export class ExpressZodAPIClient { ___ }
  protected makeClientClass = () =>
    makePublicClass(
      this.ids.clientClass,
      // constructor(protected readonly implementation: Implementation) {}
      makeEmptyInitializingConstructor([
        makeParam(
          this.ids.implementationArgument,
          f.createTypeReferenceNode(this.ids.implementationType),
          protectedReadonlyModifier,
        ),
      ]),
      [this.makeProvider()],
    );
}
