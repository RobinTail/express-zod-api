import * as R from "ramda";
import type { ResponseVariant } from "./api-response";
import { contentTypes } from "./content-type";
import { clientMethods, type ClientMethod } from "./method";
import type { makeEventSchema } from "./sse";
import { ensureTypeNode, printNode, propOf, ts } from "./typescript-api";
import type {
  CursorPaginatedResult,
  OffsetPaginatedResult,
} from "./paginated-schema";

type IOKind = "input" | "response" | ResponseVariant | "encoded";
type SSEShape = ReturnType<typeof makeEventSchema>["shape"];
type Store = Record<IOKind, ts.TypeNode>;

const ids = {
  pathType: "Path",
  implementationType: "Implementation",
  keyParameter: "key",
  pathParameter: "path",
  paramsArgument: "params",
  ctxArgument: "ctx",
  methodParameter: "method",
  requestParameter: "request",
  eventParameter: "event",
  dataParameter: "data",
  handlerParameter: "handler",
  msgParameter: "msg",
  parseRequestFn: "parseRequest",
  substituteFn: "substitute",
  provideMethod: "provide",
  onMethod: "on",
  implementationArgument: "implementation",
  hasBodyConst: "hasBody",
  undefinedValue: "undefined",
  responseConst: "response",
  restConst: "rest",
  searchParamsConst: "searchParams",
  defaultImplementationConst: "defaultImplementation",
  clientConst: "client",
  contentTypeConst: "contentType",
  isJsonConst: "isJSON",
  sourceProp: "source",
  methodType: "Method",
  someOfType: "SomeOf",
  requestType: "Request",
  paginationType: "Pagination",
} satisfies Record<string, string>;

export const interfaces: Record<IOKind, string> = {
  input: "Input",
  positive: "PositiveResponse",
  negative: "NegativeResponse",
  encoded: "EncodedResponse",
  response: "Response",
};

const quot = R.map((str: string) => `"${str}"`);

export abstract class IntegrationBase {
  /** @internal */
  protected paths = new Set<string>();
  /** @internal */
  protected tags = new Map<string, ReadonlyArray<string>>();
  /** @internal */
  protected registry = new Map<
    string,
    { store: Store; isDeprecated: boolean }
  >();

  protected constructor(protected readonly serverUrl: string) {}

  /**
   * @example export type Method = "get" | "post" | "put" | "delete" | "patch" | "head";
   * @internal
   * */
  protected makeMethodType = () =>
    `export type ${ids.methodType} = ${quot(clientMethods).join(" | ")};`;

  /**
   * @example type SomeOf<T> = T[keyof T];
   * @internal
   * */
  protected makeSomeOfType = () => `type ${ids.someOfType}<T> = T[keyof T];`;

  /**
   * @example export type Request = keyof Input;
   * @internal
   * */
  protected makeRequestType = () =>
    `export type ${ids.requestType} = keyof ${interfaces.input};`;

  /**
   * @example SomeOf<_>
   * @internal
   **/
  protected someOf = ({ name }: ts.TypeAliasDeclaration) =>
    ensureTypeNode(ids.someOfType, [name]);

  /**
   * @example export type Path = "/v1/user/retrieve" | ___;
   * @internal
   * */
  protected makePathType = () =>
    `export type ${ids.pathType} = ${quot(Array.from(this.paths)).join(" | ")};`;

  /**
   * @example export interface Input { "get /v1/user/retrieve": GetV1UserRetrieveInput; }
   * @internal
   * */
  protected makePublicInterfaces = () =>
    (Object.keys(interfaces) as IOKind[]).map(
      (kind) => (opts?: ts.PrinterOptions) =>
        `export interface ${interfaces[kind]} {\n` +
        Array.from(this.registry)
          .map(
            ([request, { store, isDeprecated }]) =>
              `  ${isDeprecated ? "/** @deprecated */\n  " : ""}"${request}": ${printNode(store[kind], opts)};`,
          )
          .join("\n") +
        `\n}`,
    );

  /**
   * @example export const endpointTags = { "get /v1/user/retrieve": ["users"] }
   * @internal
   * */
  protected makeEndpointTags = () =>
    `export const endpointTags = {\n` +
    Array.from(this.tags).map(
      ([request, tags]) => `"${request}": [${quot(tags).join(", ")}]`,
    ) +
    `}`;

  /**
   * @example export type Implementation = (method: Method, path: string, params: Record<string, any>) => Promise<any>;
   * @internal
   * */
  protected makeImplementationType = () =>
    `export type ${ids.implementationType}<T = unknown> = (${ids.methodParameter}: ${ids.methodType}, ${ids.pathParameter}: string, ${ids.paramsArgument}: Record<string, any>, ${ids.ctxArgument}?: T) => Promise<any>;`;

  /**
   * @example const parseRequest = (request: string) => request.split(/ (.+)/, 2) as [Method, Path];
   * @internal
   * @desc split once, excludes the third empty element
   * */
  protected makeParseRequestFn = () =>
    `const ${ids.parseRequestFn} = (${ids.requestParameter}: string) => ${ids.requestParameter}.${String.prototype.split.name}(/ (.+)/, 2) as [${ids.methodType}, ${ids.pathType}];`;

  /**
   * @example const substitute = (path: string, params: Record<string, any>) => { ___ return [path, rest] as const; }
   * @internal
   * */
  protected makeSubstituteFn = () =>
    `const ${ids.substituteFn} = (${ids.pathParameter}: string, ${ids.paramsArgument}: Record<string, any>) => {\n` +
    `  const ${ids.restConst} = { ...${ids.paramsArgument} };` +
    `  for (const ${ids.keyParameter} in ${ids.paramsArgument}) {` +
    `    ${ids.pathParameter} = ${ids.pathParameter}.${String.prototype.replace.name}(\`:\${${ids.keyParameter}}\`, () => {` +
    `      delete ${ids.restConst}[${ids.keyParameter}];` +
    `      return ${ids.paramsArgument}[${ids.keyParameter}];` +
    `    });` +
    `  }` +
    `  return [${ids.pathParameter}, ${ids.restConst}] as const;` +
    `}`;

  /**
   * @example { nextCursor: string | null } | { total, limit, offset: number }
   * @internal
   */
  protected makePaginationType = () => {
    const nextCursorProp =
      propOf<CursorPaginatedResult["output"]["shape"]>("nextCursor");
    const totalProp = propOf<OffsetPaginatedResult["output"]["shape"]>("total");
    const limitProp = propOf<OffsetPaginatedResult["output"]["shape"]>("limit");
    const offsetProp =
      propOf<OffsetPaginatedResult["output"]["shape"]>("offset");
    return `type Pagination = { ${nextCursorProp}: string | null } | { ${totalProp}: number; ${limitProp}: number; ${offsetProp}: number }`;
  };

  /**
   * @example export class Client { ___ }
   * @internal
   * */
  protected makeClientClass = (name: string) => {
    const nextCursorProp =
      propOf<CursorPaginatedResult["output"]["shape"]>("nextCursor");
    const offsetProp =
      propOf<OffsetPaginatedResult["output"]["shape"]>("offset");
    const limitProp = propOf<OffsetPaginatedResult["output"]["shape"]>("limit");
    const totalProp = propOf<OffsetPaginatedResult["output"]["shape"]>("total");
    return (
      `export class ${name}<T> {` +
      `  public constructor(` +
      `    protected readonly ${ids.implementationArgument}: ${ids.implementationType}<T> = ${ids.defaultImplementationConst},` +
      `  ) {}` +
      `  public ${ids.provideMethod}<K extends ${ids.requestType}>(` +
      `    ${ids.requestParameter}: K,` +
      `    ${ids.paramsArgument}: Input[K],` +
      `    ${ids.ctxArgument}?: T,` +
      `  ): Promise<${interfaces.response}[K]> {` +
      `    const [${ids.methodParameter}, ${ids.pathParameter}] = ${ids.parseRequestFn}(${ids.requestParameter});` +
      `    return this.${ids.implementationArgument}(${ids.methodParameter}, ...${ids.substituteFn}(${ids.pathParameter}, ${ids.paramsArgument}), ${ids.ctxArgument});` +
      `  }` +
      `  public static hasMore(${ids.responseConst}: ${ids.paginationType}): boolean {` +
      `    if ("${nextCursorProp}" in ${ids.responseConst}) return ${ids.responseConst}.${nextCursorProp} !== null;` +
      `    return ${ids.responseConst}.${offsetProp} + ${ids.responseConst}.${limitProp} < ${ids.responseConst}.${totalProp};` +
      `  }` +
      `}`
    );
  };

  /**
   * @example export const defaultImplementation: Implementation = async (method,path,params) => { ___ };
   * @internal
   * */
  protected makeDefaultImplementation = () => {
    return (
      `const ${ids.defaultImplementationConst}: ${ids.implementationType} = async (${ids.methodParameter}, ${ids.pathParameter}, ${ids.paramsArgument}) => {` +
      `  const ${ids.hasBodyConst} = ![${quot(["get", "head", "delete"] satisfies ClientMethod[]).join(", ")}].includes(${ids.methodParameter});` +
      `  const ${ids.searchParamsConst} = ${ids.hasBodyConst} ? "" : \`?\${new ${URLSearchParams.name}(${ids.paramsArgument})}\`;` +
      `  const ${ids.responseConst} = await ${fetch.name}(` +
      `    new ${URL.name}(\`\${${ids.pathParameter}}\${${ids.searchParamsConst}}\`, "${this.serverUrl}"),` +
      `    {` +
      `      ${propOf<RequestInit>("method")}: ${ids.methodParameter}.${String.prototype.toUpperCase.name}(),` +
      `      ${propOf<RequestInit>("headers")}: ${ids.hasBodyConst} ? { "Content-Type": "${contentTypes.json}" } : ${ids.undefinedValue},` +
      `      ${propOf<RequestInit>("body")}: ${ids.hasBodyConst} ? JSON.${propOf<JSON>("stringify")}(${ids.paramsArgument}) : ${ids.undefinedValue},` +
      `    },` +
      `  );` +
      `  const ${ids.contentTypeConst} = ${ids.responseConst}.${propOf<Response>("headers")}.${propOf<Headers>("get")}("content-type");` +
      `  if (!${ids.contentTypeConst}) return;` +
      `  const ${ids.isJsonConst} = ${ids.contentTypeConst}.${String.prototype.startsWith.name}("${contentTypes.json}");` +
      `  return ${ids.responseConst}[${ids.isJsonConst} ? "${propOf<Response>("json")}" : "${propOf<Response>("text")}"]();` +
      `};`
    );
  };

  /**
   * @example export class Subscription<K extends Extract<___>, R extends Extract<___>> { ___ }
   * @internal
   * */
  protected makeSubscriptionClass = (name: string) => {
    return (
      `export class ${name}<` +
      `  K extends Extract<${ids.requestType}, \`get \${string}\`>,` +
      `  R extends Extract<${interfaces.positive}[K], { ${propOf<SSEShape>("event")}: string }>,` +
      `> {` +
      `  public ${ids.sourceProp}: EventSource;` +
      `  public constructor(${ids.requestParameter}: K, ${ids.paramsArgument}: ${interfaces.input}[K]) {` +
      `    const [${ids.pathParameter}, ${ids.restConst}] = ${ids.substituteFn}(${ids.parseRequestFn}(${ids.requestParameter})[1], ${ids.paramsArgument});` +
      `    const ${ids.searchParamsConst} = \`?\${new ${URLSearchParams.name}(${ids.restConst})}\`;` +
      `    this.${ids.sourceProp} = new EventSource(` +
      `      new URL(\`\${${ids.pathParameter}}\${${ids.searchParamsConst}}\`, "${this.serverUrl}"),` +
      `    );` +
      `  }` +
      `  public ${ids.onMethod}<E extends R["${propOf<SSEShape>("event")}"]>(` +
      `    ${propOf<SSEShape>("event")}: E,` +
      `    ${ids.handlerParameter}: (${ids.dataParameter}: Extract<R, { ${propOf<SSEShape>("event")}: E }>["${propOf<SSEShape>("data")}"]) => void | Promise<void>,` +
      `  ) {` +
      `    this.${ids.sourceProp}.${propOf<EventSource>("addEventListener")}(${ids.eventParameter}, (${ids.msgParameter}) =>` +
      `      ${ids.handlerParameter}(JSON.${propOf<JSON>("parse")}((${ids.msgParameter} as ${MessageEvent.name}).${propOf<SSEShape>("data")})),` +
      `    );` +
      `    return this;` +
      `  }` +
      `}`
    );
  };

  /** @internal */
  protected makeUsageStatements = (
    clientClassName: string,
    subscriptionClassName: string,
  ) =>
    `const ${ids.clientConst} = new ${clientClassName}();` +
    `${ids.clientConst}.${ids.provideMethod}("get /v1/user/retrieve", { id: "10" });` +
    `new ${subscriptionClassName}("get /v1/events/stream", {}).${ids.onMethod}("time", (time) => {});`;
}
