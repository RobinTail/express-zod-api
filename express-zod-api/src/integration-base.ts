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
  Path: "Path",
  Implementation: "Implementation",
  key: "key",
  path: "path",
  params: "params",
  ctx: "ctx",
  method: "method",
  request: "request",
  event: "event",
  data: "data",
  handler: "handler",
  msg: "msg",
  parseRequest: "parseRequest",
  substitute: "substitute",
  provide: "provide",
  on: "on",
  implementation: "implementation",
  hasBody: "hasBody",
  undefined: "undefined",
  response: "response",
  rest: "rest",
  searchParams: "searchParams",
  defaultImplementation: "defaultImplementation",
  client: "client",
  contentType: "contentType",
  isJSON: "isJSON",
  source: "source",
  Method: "Method",
  SomeOf: "SomeOf",
  Request: "Request",
  Pagination: "Pagination",
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
    `export type ${ids.Method} = ${quot(clientMethods).join(" | ")};`;

  /**
   * @example type SomeOf<T> = T[keyof T];
   * @internal
   * */
  protected makeSomeOfType = () => `type ${ids.SomeOf}<T> = T[keyof T];`;

  /**
   * @example export type Request = keyof Input;
   * @internal
   * */
  protected makeRequestType = () =>
    `export type ${ids.Request} = keyof ${interfaces.input};`;

  /**
   * @example SomeOf<_>
   * @internal
   **/
  protected someOf = ({ name }: ts.TypeAliasDeclaration) =>
    ensureTypeNode(ids.SomeOf, [name]);

  /**
   * @example export type Path = "/v1/user/retrieve" | ___;
   * @internal
   * */
  protected makePathType = () =>
    `export type ${ids.Path} = ${quot(Array.from(this.paths)).join(" | ")};`;

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
    `export type ${ids.Implementation}<T = unknown> = (${ids.method}: ${ids.Method}, ${ids.path}: string, ${ids.params}: Record<string, any>, ${ids.ctx}?: T) => Promise<any>;`;

  /**
   * @example const parseRequest = (request: string) => request.split(/ (.+)/, 2) as [Method, Path];
   * @internal
   * @desc split once, excludes the third empty element
   * */
  protected makeParseRequestFn = () =>
    `const ${ids.parseRequest} = (${ids.request}: string) => ${ids.request}.${String.prototype.split.name}(/ (.+)/, 2) as [${ids.Method}, ${ids.Path}];`;

  /**
   * @example const substitute = (path: string, params: Record<string, any>) => { ___ return [path, rest] as const; }
   * @internal
   * */
  protected makeSubstituteFn = () =>
    `const ${ids.substitute} = (${ids.path}: string, ${ids.params}: Record<string, any>) => {\n` +
    `  const ${ids.rest} = { ...${ids.params} };` +
    `  for (const ${ids.key} in ${ids.params}) {` +
    `    ${ids.path} = ${ids.path}.${String.prototype.replace.name}(\`:\${${ids.key}}\`, () => {` +
    `      delete ${ids.rest}[${ids.key}];` +
    `      return ${ids.params}[${ids.key}];` +
    `    });` +
    `  }` +
    `  return [${ids.path}, ${ids.rest}] as const;` +
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
    return `type ${ids.Pagination} = { ${nextCursorProp}: string | null } | { ${totalProp}: number; ${limitProp}: number; ${offsetProp}: number }`;
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
      `    protected readonly ${ids.implementation}: ${ids.Implementation}<T> = ${ids.defaultImplementation},` +
      `  ) {}` +
      `  public ${ids.provide}<K extends ${ids.Request}>(` +
      `    ${ids.request}: K,` +
      `    ${ids.params}: ${interfaces.input}[K],` +
      `    ${ids.ctx}?: T,` +
      `  ): Promise<${interfaces.response}[K]> {` +
      `    const [${ids.method}, ${ids.path}] = ${ids.parseRequest}(${ids.request});` +
      `    return this.${ids.implementation}(${ids.method}, ...${ids.substitute}(${ids.path}, ${ids.params}), ${ids.ctx});` +
      `  }` +
      `  public static hasMore(${ids.response}: ${ids.Pagination}): boolean {` +
      `    if ("${nextCursorProp}" in ${ids.response}) return ${ids.response}.${nextCursorProp} !== null;` +
      `    return ${ids.response}.${offsetProp} + ${ids.response}.${limitProp} < ${ids.response}.${totalProp};` +
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
      `const ${ids.defaultImplementation}: ${ids.Implementation} = async (${ids.method}, ${ids.path}, ${ids.params}) => {` +
      `  const ${ids.hasBody} = ![${quot(["get", "head", "delete"] satisfies ClientMethod[]).join(", ")}].includes(${ids.method});` +
      `  const ${ids.searchParams} = ${ids.hasBody} ? "" : \`?\${new ${URLSearchParams.name}(${ids.params})}\`;` +
      `  const ${ids.response} = await ${fetch.name}(` +
      `    new ${URL.name}(\`\${${ids.path}}\${${ids.searchParams}}\`, "${this.serverUrl}"),` +
      `    {` +
      `      ${propOf<RequestInit>("method")}: ${ids.method}.${String.prototype.toUpperCase.name}(),` +
      `      ${propOf<RequestInit>("headers")}: ${ids.hasBody} ? { "Content-Type": "${contentTypes.json}" } : ${ids.undefined},` +
      `      ${propOf<RequestInit>("body")}: ${ids.hasBody} ? JSON.${propOf<JSON>("stringify")}(${ids.params}) : ${ids.undefined},` +
      `    },` +
      `  );` +
      `  const ${ids.contentType} = ${ids.response}.${propOf<Response>("headers")}.${propOf<Headers>("get")}("content-type");` +
      `  if (!${ids.contentType}) return;` +
      `  const ${ids.isJSON} = ${ids.contentType}.${String.prototype.startsWith.name}("${contentTypes.json}");` +
      `  return ${ids.response}[${ids.isJSON} ? "${propOf<Response>("json")}" : "${propOf<Response>("text")}"]();` +
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
      `  K extends Extract<${ids.Request}, \`get \${string}\`>,` +
      `  R extends Extract<${interfaces.positive}[K], { ${propOf<SSEShape>("event")}: string }>,` +
      `> {` +
      `  public ${ids.source}: EventSource;` +
      `  public constructor(${ids.request}: K, ${ids.params}: ${interfaces.input}[K]) {` +
      `    const [${ids.path}, ${ids.rest}] = ${ids.substitute}(${ids.parseRequest}(${ids.request})[1], ${ids.params});` +
      `    const ${ids.searchParams} = \`?\${new ${URLSearchParams.name}(${ids.rest})}\`;` +
      `    this.${ids.source} = new EventSource(` +
      `      new URL(\`\${${ids.path}}\${${ids.searchParams}}\`, "${this.serverUrl}"),` +
      `    );` +
      `  }` +
      `  public ${ids.on}<E extends R["${propOf<SSEShape>("event")}"]>(` +
      `    ${propOf<SSEShape>("event")}: E,` +
      `    ${ids.handler}: (${ids.data}: Extract<R, { ${propOf<SSEShape>("event")}: E }>["${propOf<SSEShape>("data")}"]) => void | Promise<void>,` +
      `  ) {` +
      `    this.${ids.source}.${propOf<EventSource>("addEventListener")}(${ids.event}, (${ids.msg}) =>` +
      `      ${ids.handler}(JSON.${propOf<JSON>("parse")}((${ids.msg} as ${MessageEvent.name}).${propOf<SSEShape>("data")})),` +
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
    `const ${ids.client} = new ${clientClassName}();` +
    `${ids.client}.${ids.provide}("get /v1/user/retrieve", { id: "10" });` +
    `new ${subscriptionClassName}("get /v1/events/stream", {}).${ids.on}("time", (time) => {});`;
}
