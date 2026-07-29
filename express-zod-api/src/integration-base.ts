import type { ResponseVariant } from "./api-response";
import { contentTypes } from "./content-type";
import { clientMethods, type ClientMethod } from "./method";
import type { makeEventSchema } from "./sse";
import type {
  CursorPaginatedResult,
  OffsetPaginatedResult,
} from "./paginated-schema";

type IOKind = "input" | "response" | ResponseVariant | "encoded";
type SSEShape = ReturnType<typeof makeEventSchema>["shape"];
type Store = Record<IOKind, string>;

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
  isBlob: "isBlob",
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

const quot = (items: Iterable<string>) => Array.from(items, (s) => `"${s}"`);

const propOf = <T>(name: keyof NoInfer<T>) => name as string;

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
  protected makeMethodType = () => {
    const union = quot(clientMethods).join(" | ");
    return `export type ${ids.Method} = ${union};`;
  };

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
  protected someOf = (name: string) => `${ids.SomeOf}<${name}>`;

  /**
   * @example export type Path = "/v1/user/retrieve" | ___;
   * @internal
   * */
  protected makePathType = () => {
    const union = quot(this.paths).join(" | ");
    return `export type ${ids.Path} = ${union};`;
  };

  /**
   * @example export interface Input { "get /v1/user/retrieve": GetV1UserRetrieveInput; }
   * @internal
   * */
  protected makePublicInterfaces = () =>
    (Object.keys(interfaces) as IOKind[]).map((kind) => {
      const props = Array.from(this.registry)
        .map(
          ([request, { store, isDeprecated }]) =>
            `  ${isDeprecated ? "/** @deprecated */\n  " : ""}"${request}": ${store[kind]};`,
        )
        .join("\n");
      return `export interface ${interfaces[kind]} {\n${props}\n}`;
    });

  /**
   * @example export const endpointTags = { "get /v1/user/retrieve": ["users"] }
   * @internal
   * */
  protected makeEndpointTags = () => {
    const props = Array.from(this.tags)
      .map(([request, tags]) => `  "${request}": [${quot(tags).join(", ")}]`)
      .join(",\n");
    return `export const endpointTags = {\n${props}\n}`;
  };

  /**
   * @example export type Implementation = (method: Method, path: string, params: Record<string, any>) => Promise<any>;
   * @internal
   * */
  protected makeImplementationType = () => {
    const args = [
      `${ids.method}: ${ids.Method}`,
      `${ids.path}: string`,
      `${ids.params}: Record<string, any>`,
      `${ids.ctx}?: T`,
    ].join(",");
    return `export type ${ids.Implementation}<T = unknown> = (${args}) => Promise<any>;`;
  };

  /**
   * @example const parseRequest = (request: string) => request.split(/ (.+)/, 2) as [Method, Path];
   * @internal
   * @desc split once, excludes the third empty element
   * */
  protected makeParseRequestFn = () => {
    const args = `${ids.request}: string`;
    const tuple = `[${ids.Method}, ${ids.Path}]`;
    const implementation = `${ids.request}.${propOf<string>("split")}(/ (.+)/, 2) as ${tuple}`;
    return `const ${ids.parseRequest} = (${args}) => ${implementation};`;
  };

  /**
   * @example const substitute = (path: string, params: Record<string, any>) => { ___ return [path, rest] as const; }
   * @internal
   * */
  protected makeSubstituteFn = () => {
    const paramsType = `Record<string, any>`;
    const args = `${ids.path}: string, ${ids.params}: ${paramsType}`;
    const placeholder = `\`:\${${ids.key}}\``;
    const returns = `: [typeof ${ids.path}, typeof ${ids.params}]`;
    return [
      `const ${ids.substitute} = (${args})${returns} => {`,
      `  if (${ids.params} instanceof Blob) return [${ids.path}, ${ids.params}] as const;`,
      `  const ${ids.rest} = { ...${ids.params} };`,
      `  for (const ${ids.key} in ${ids.params}) {`,
      `    ${ids.path} = ${ids.path}.${propOf<string>("replace")}(${placeholder}, () => {`,
      `      delete ${ids.rest}[${ids.key}];`,
      `      return ${ids.params}[${ids.key}];`,
      `    });`,
      `  }`,
      `  return [${ids.path}, ${ids.rest}] as const;`,
      `}`,
    ].join("\n");
  };

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
    const cursorVariant = `{ ${nextCursorProp}: string | null }`;
    const offsetVariant = `{ ${totalProp}: number; ${limitProp}: number; ${offsetProp}: number }`;
    return `type ${ids.Pagination} = ${cursorVariant} | ${offsetVariant}`;
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
    const callArgs = `${ids.method}, ...${ids.substitute}(${ids.path}, ${ids.params}), ${ids.ctx}`;
    return [
      `export class ${name}<T> {`,
      `  public constructor(`,
      `    protected readonly ${ids.implementation}: ${ids.Implementation}<T> = ${ids.defaultImplementation},`,
      `  ) {}`,
      `  public ${ids.provide}<K extends ${ids.Request}>(`,
      `    ${ids.request}: K,`,
      `    ${ids.params}: ${interfaces.input}[K],`,
      `    ${ids.ctx}?: T,`,
      `  ): Promise<${interfaces.response}[K]> {`,
      `    const [${ids.method}, ${ids.path}] = ${ids.parseRequest}(${ids.request});`,
      `    return this.${ids.implementation}(${callArgs});`,
      `  }`,
      `  public static hasMore(${ids.response}: ${ids.Pagination}): boolean {`,
      `    if ("${nextCursorProp}" in ${ids.response}) return ${ids.response}.${nextCursorProp} !== null;`,
      `    return ${ids.response}.${offsetProp} + ${ids.response}.${limitProp} < ${ids.response}.${totalProp};`,
      `  }`,
      `}`,
    ].join("\n");
  };

  /**
   * @example export const defaultImplementation: Implementation = async (method,path,params) => { ___ };
   * @internal
   * */
  protected makeDefaultImplementation = () => {
    const args = `${ids.method}, ${ids.path}, ${ids.params}`;
    const noBodyMethods = quot([
      "get",
      "head",
      "delete",
    ] satisfies ClientMethod[]).join(", ");
    const headers = `${ids.isBlob} ? { "Content-Type": "${contentTypes.raw}" } : ${ids.hasBody} ? { "Content-Type": "${contentTypes.json}" } : ${ids.undefined}`;
    const body = `${ids.isBlob} ? ${ids.params} : ${ids.hasBody} ? JSON.${propOf<JSON>("stringify")}(${ids.params}) : ${ids.undefined}`;
    const contentType = `${ids.response}.${propOf<Response>("headers")}.${propOf<Headers>("get")}("content-type")`;
    const parser = `${ids.isJSON} ? "${propOf<Response>("json")}" : "${propOf<Response>("text")}"`;
    return [
      `const ${ids.defaultImplementation}: ${ids.Implementation} = async (${args}) => {`,
      `  const ${ids.isBlob} = ${ids.params} instanceof Blob;`,
      `  const ${ids.hasBody} = ![${noBodyMethods}].includes(${ids.method});`,
      `  const ${ids.searchParams} = ${ids.isBlob} || ${ids.hasBody} ? "" : \`?\${new ${URLSearchParams.name}(${ids.params})}\`;`,
      `  const ${ids.response} = await ${fetch.name}(`,
      `    new ${URL.name}(\`\${${ids.path}}\${${ids.searchParams}}\`, "${this.serverUrl}"),`,
      `    {`,
      `      ${propOf<RequestInit>("method")}: ${ids.method}.${propOf<string>("toUpperCase")}(),`,
      `      ${propOf<RequestInit>("headers")}: ${headers},`,
      `      ${propOf<RequestInit>("body")}: ${body},`,
      `    },`,
      `  );`,
      `  const ${ids.contentType} = ${contentType};`,
      `  if (!${ids.contentType}) return;`,
      `  const ${ids.isJSON} = ${ids.contentType}.${propOf<string>("startsWith")}("${contentTypes.json}");`,
      `  return ${ids.response}[${parser}]();`,
      `};`,
    ].join("\n");
  };

  /**
   * @example export class Subscription<K extends Extract<___>, R extends Extract<___>> { ___ }
   * @internal
   * */
  protected makeSubscriptionClass = (name: string) => {
    const substitution = `${ids.substitute}(${ids.parseRequest}(${ids.request})[1], ${ids.params})`;
    const dataType = `Extract<R, { ${propOf<SSEShape>("event")}: E }>["${propOf<SSEShape>("data")}"]`;
    const data = `(${ids.msg} as ${MessageEvent.name}).${propOf<SSEShape>("data")}`;
    return [
      `export class ${name}<`,
      `  K extends Extract<${ids.Request}, \`get \${string}\`>,`,
      `  R extends Extract<${interfaces.positive}[K], { ${propOf<SSEShape>("event")}: string }>,`,
      `> {`,
      `  public ${ids.source}: EventSource;`,
      `  public constructor(${ids.request}: K, ${ids.params}: ${interfaces.input}[K]) {`,
      `    const [${ids.path}, ${ids.rest}] = ${substitution};`,
      `    const ${ids.searchParams} = \`?\${new ${URLSearchParams.name}(${ids.rest})}\`;`,
      `    this.${ids.source} = new EventSource(`,
      `      new URL(\`\${${ids.path}}\${${ids.searchParams}}\`, "${this.serverUrl}"),`,
      `    );`,
      `  }`,
      `  public ${ids.on}<E extends R["${propOf<SSEShape>("event")}"]>(`,
      `    ${propOf<SSEShape>("event")}: E,`,
      `    ${ids.handler}: (${ids.data}: ${dataType}) => void | Promise<void>,`,
      `  ) {`,
      `    this.${ids.source}.${propOf<EventSource>("addEventListener")}(${ids.event}, (${ids.msg}) =>`,
      `      ${ids.handler}(JSON.${propOf<JSON>("parse")}(${data})),`,
      `    );`,
      `    return this;`,
      `  }`,
      `}`,
    ].join("\n");
  };

  /** @internal */
  protected makeUsageStatements = (
    clientClassName: string,
    subscriptionClassName: string,
  ) =>
    [
      `const ${ids.client} = new ${clientClassName}();`,
      `${ids.client}.${ids.provide}("get /v1/user/retrieve", { id: "10" });`,
      `new ${subscriptionClassName}("get /v1/events/stream", {}).${ids.on}("time", (time) => {});`,
    ].join("\n");
}
