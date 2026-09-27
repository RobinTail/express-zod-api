/**
 * @fileOverview The entrypoint for generating Integration code
 * @requires typescript
 * */
export type { Producer } from "./zts-helpers";
import * as R from "ramda";
import { z } from "zod";
import { responseVariants, type ResponseVariant } from "./api-response";
import { IntegrationBase, interfaces } from "./integration-base";
import { shouldHaveContent, makeCleanId } from "./common-helpers";
import { loadPeer } from "./peer-helpers";
import type { Routing } from "./routing";
import { ensureTypeNode, isTypeName, printNode, ts } from "./typescript-api";
import { walkRouting, withHead, type OnEndpoint } from "./routing-walker";
import type { HandlingRules } from "./schema-walker";
import { zodToTs } from "./zts";
import type { ZTSContext } from "./zts-helpers";
import type * as OxFmt from "oxfmt";
import type { ClientMethod } from "./method";
import type { CommonConfig } from "./config-type";
import { getSecurityNames } from "./security";
import { findIdentified } from "./metadata";

interface IntegrationParams {
  routing: Routing;
  config: CommonConfig;
  /**
   * @desc What should be generated
   * @example "types" — types of your endpoint requests and responses (for a DIY solution)
   * @example "client" — an entity for performing typed requests and receiving typed responses
   * @default "client"
   * */
  variant?: "types" | "client";
  /** @default Client */
  clientClassName?: string;
  /** @default Subscription */
  subscriptionClassName?: string;
  /**
   * @desc The API URL to use in the generated code
   * @default https://example.com
   * */
  serverUrl?: string;
  /**
   * @desc The schema to use for responses without body such as 204
   * @default z.undefined()
   * */
  noBodySchema?: z.ZodType;
  /**
   * @desc Depict the HEAD method for each Endpoint supporting the GET method (feature of Express)
   * @default true
   * */
  hasHeadMethod?: boolean;
  /**
   * @desc Handling rules for your own schemas branded with `x-brand` metadata.
   * @desc Keys: brands (recommended to use unique symbols).
   * @desc Values: functions having schema as first argument that you should assign type to, second one is a context.
   * @example { MyBrand: (schema: typeof myBrandSchema, { next }) => createKeywordTypeNode(SyntaxKind.AnyKeyword)
   * @link https://www.npmjs.com/package/@express-zod-api/zod-plugin
   */
  brandHandling?: HandlingRules<ts.TypeNode, ZTSContext>;
  /**
   * @desc Whether the server supports credentials in cross-origin requests.
   * @desc It sets `credentials: "include"` in Client default Implementation and `withCredentials` in Subscription.
   * @desc Requires the CORS configuration that includes:
   * @desc `Access-Control-Allow-Credentials: true` and a specific `Access-Control-Allow-Origin` headers.
   * @default false
   * */
  hasCredentials?: boolean;
}

interface FormattedPrintingOptions {
  /** @desc Typescript printer options */
  printerOptions?: ts.PrinterOptions;
  /**
   * @desc Typescript code formatter
   * @default prettier.format | oxfmt.format
   * */
  format?: (program: string) => Promise<string>;
}

type IO = "input" | "output";
const ioKinds: IO[] = ["input", "output"];
const getIO = (isResponse: boolean): IO => (isResponse ? "output" : "input");

interface AliasProbe {
  proposedName?: string;
  /** @desc Stands for the alias within the bodies */
  token: string;
  /** @desc Printed types of the alias for each direction it's used in */
  bodies: Partial<Record<IO, string>>;
  /** @desc The aliases referred from the bodies */
  nested: Set<object>;
}

/** @desc The aliases having different types for request and response, including the ones referring to them */
const findDirectional = (probes: Map<object, AliasProbe>) => {
  const isBidirectional = (key: object) => {
    const { input, output } = probes.get(key)!.bodies; // ensured by probing
    return input !== undefined && output !== undefined;
  };
  const parents = new Map<object, object[]>();
  const directional = new Set<object>();
  for (const [key, { nested, bodies }] of probes) {
    for (const child of nested)
      parents.set(child, (parents.get(child) || []).concat(key));
    if (isBidirectional(key) && bodies.input !== bodies.output)
      directional.add(key);
  }
  for (const key of directional) {
    for (const parent of parents.get(key) || [])
      if (isBidirectional(parent)) directional.add(parent);
  }
  return directional;
};

export class Integration extends IntegrationBase {
  readonly #program: Array<string | ((opts?: ts.PrinterOptions) => string)> =
    [];
  /** @desc The names of declared aliases by their keys for each direction */
  readonly #aliases: Record<IO, Map<object, string>> = {
    input: new Map(),
    output: new Map(),
  };
  /** @desc The names assigned to the keys of aliases after their ids */
  readonly #named = new Map<object, string>();
  #directional = new Set<object>();
  readonly #taken = new Set<string>();
  #lastIndex = 0;
  #usage?: string;

  #makeName() {
    let name: string;
    do name = `Type${++this.#lastIndex}`;
    while (this.#taken.has(name));
    this.#taken.add(name);
    return name;
  }

  #makeAlias(key: object, produce: () => ts.TypeNode, io: IO): ts.TypeNode {
    const declared = this.#aliases[io].get(key);
    if (declared) return ensureTypeNode(declared);
    const name = this.#named.get(key) || this.#makeName();
    const directions = this.#directional.has(key) ? [io] : ioKinds;
    for (const one of directions) this.#aliases[one].set(key, name);
    const node = produce();
    const exported = this.#named.has(key) ? "export " : "";
    this.#program.push(
      (opts) => `${exported}type ${name} = ${printNode(node, opts)};`,
    );
    return ensureTypeNode(name);
  }

  /** @desc Returns the name assigned to the schema after its id */
  #getNamed(schema: z.core.$ZodType) {
    const identified = findIdentified(schema);
    return identified && this.#named.get(identified.schema);
  }

  /** @desc The first pass: learns the aliases and their types for each direction, reserves the Endpoint type names */
  #probe(
    walk: (onEndpoint: OnEndpoint<ClientMethod>) => void,
    brandHandling: IntegrationParams["brandHandling"],
    noBodySchema: z.ZodType,
  ) {
    const probes = new Map<object, AliasProbe>();
    const stack: AliasProbe[] = [];
    const makeCtx = (isResponse: boolean): ZTSContext => ({
      isResponse,
      makeAlias: (key, produce, proposedName) => {
        const io = getIO(isResponse);
        let probe = probes.get(key);
        if (!probe) {
          const token = `T${probes.size}`;
          probe = { proposedName, token, bodies: {}, nested: new Set() };
          probes.set(key, probe);
        }
        stack.at(-1)?.nested.add(key);
        if (probe.bodies[io] === undefined) {
          probe.bodies[io] = ""; // pending: cyclic references get the token
          stack.push(probe);
          probe.bodies[io] = printNode(produce());
          stack.pop();
        }
        return ensureTypeNode(probe.token);
      },
    });
    const ctxIn = { brandHandling, ctx: makeCtx(false) };
    const ctxOut = { brandHandling, ctx: makeCtx(true) };
    walk((method, path, endpoint) => {
      const entitle = makeCleanId.bind(null, method, path);
      this.#taken.add(entitle("input"));
      zodToTs(endpoint.inputSchema, ctxIn);
      for (const variant of responseVariants) {
        const responses = endpoint.getResponses(variant);
        for (const [idx, { schema, mimeTypes }] of responses.entries()) {
          this.#taken.add(entitle(variant, "variant", `${idx + 1}`));
          const hasBody = shouldHaveContent(method, mimeTypes);
          zodToTs(hasBody ? schema : noBodySchema, ctxOut);
        }
      }
    });
    return probes;
  }

  /**
   * @desc Names the aliases after their ids when possible, the rest are named Type1, Type2, etc. when declared.
   * @desc The alias having different types for request and response is declared separately for each direction.
   * */
  #assignNames(probes: Map<object, AliasProbe>) {
    this.#directional = findDirectional(probes);
    const proposals = R.countBy(
      (name: string) => name,
      Array.from(probes.values())
        .map(R.prop("proposedName"))
        .filter(R.isNotNil),
    );
    for (const [key, { proposedName: name }] of probes) {
      if (!name || proposals[name] !== 1 || this.#taken.has(name)) continue; // duplicate or reserved
      if (!isTypeName(name) || this.#directional.has(key)) continue;
      this.#named.set(key, name);
      this.#taken.add(name);
    }
  }

  public constructor({
    routing,
    config,
    brandHandling,
    variant = "client",
    clientClassName = "Client",
    subscriptionClassName = "Subscription",
    serverUrl = "https://example.com",
    noBodySchema = z.undefined(),
    hasHeadMethod = true,
    hasCredentials = false,
  }: IntegrationParams) {
    super(serverUrl);
    const reserved = [clientClassName, subscriptionClassName];
    for (const name of this.makeReservedNames(...reserved))
      this.#taken.add(name);
    const walk = (onEndpoint: OnEndpoint<ClientMethod>) =>
      walkRouting({
        routing,
        config,
        onEndpoint: hasHeadMethod ? withHead(onEndpoint) : onEndpoint,
      });
    this.#assignNames(this.#probe(walk, brandHandling, noBodySchema));
    const makeCtx = (isResponse: boolean): ZTSContext => ({
      isResponse,
      makeAlias: (key, produce) =>
        this.#makeAlias(key, produce, getIO(isResponse)),
    });
    const ctxIn = { brandHandling, ctx: makeCtx(false) };
    const ctxOut = { brandHandling, ctx: makeCtx(true) };
    let hasCookies = false;
    const onEndpoint: OnEndpoint<ClientMethod> = (method, path, endpoint) => {
      const entitle = makeCleanId.bind(null, method, path);
      const { isDeprecated, inputSchema, tags } = endpoint;
      const request = `${method} ${path}`;
      const cookies = getSecurityNames(endpoint.security, "cookie");
      if (cookies.size) hasCookies = true;
      const inputTypeNode = zodToTs(inputSchema, ctxIn);
      const namedInput = cookies.size
        ? undefined // requires Omit
        : this.#getNamed(inputSchema);
      const inputTypeName = namedInput ?? entitle("input");
      if (!namedInput) {
        this.#program.push((opts) => {
          const printed = printNode(inputTypeNode, opts);
          const type = cookies.size
            ? this.makeOmit(printed, cookies, "security cookies")
            : printed;
          return `/** ${request} */\ntype ${inputTypeName} = ${type};`;
        });
      }
      const names: Record<ResponseVariant | "encoded", Set<string>> = {
        positive: new Set(),
        negative: new Set(),
        encoded: new Set(),
      };
      for (const responseVariant of responseVariants) {
        const responses = endpoint.getResponses(responseVariant);
        for (const [
          idx,
          { schema, mimeTypes, statusCodes },
        ] of responses.entries()) {
          const subject = shouldHaveContent(method, mimeTypes)
            ? schema
            : noBodySchema;
          const variantTypeNode = zodToTs(subject, ctxOut);
          const namedVariant = this.#getNamed(subject);
          const variantName =
            namedVariant ?? entitle(responseVariant, "variant", `${idx + 1}`);
          if (!namedVariant) {
            this.#program.push(
              (opts) =>
                `/** ${request} */\ntype ${variantName} = ${printNode(variantTypeNode, opts)};`,
            );
          }
          names[responseVariant].add(variantName);
          names.encoded.add(
            this.makeDiscriminator(statusCodes, responseVariant, variantName),
          );
        }
      }
      this.paths.add(path);
      const store = {
        input: inputTypeName,
        positive: Array.from(names.positive).join(" | "),
        negative: Array.from(names.negative).join(" | "),
        response: `${interfaces.encoded}["${request}"]["data"]`,
        encoded: Array.from(names.encoded).join(" | "),
      };
      this.registry.set(request, { isDeprecated, store });
      this.tags.set(request, tags);
    };
    walk(onEndpoint);
    this.#program.push(
      this.makePathType(),
      this.makeMethodType(),
      ...this.makePublicInterfaces(),
      this.makeRequestType(),
    );

    if (variant === "types") return;

    this.#program.push(
      this.makeEndpointTags(),
      this.makeParseRequestFn(),
      this.makeSubstituteFn(),
      this.makeImplementationType(),
      this.makePaginationType(),
      this.makeDefaultContextType(),
      this.makeDefaultImplementation(hasCredentials && hasCookies),
      this.makeClientClass(clientClassName),
      this.makeSubscriptionClass(
        subscriptionClassName,
        hasCredentials && hasCookies,
      ),
    );

    this.#usage = this.makeUsageStatements(
      clientClassName,
      subscriptionClassName,
    );
  }

  public print(printerOptions?: ts.PrinterOptions) {
    const parts = this.#program.map((entry) =>
      typeof entry === "function" ? entry(printerOptions) : entry,
    );
    if (this.#usage) parts.push(`// Usage example:\n/*\n${this.#usage}*/`);
    return parts.join("\n\n");
  }

  public async printFormatted({
    printerOptions,
    format: userDefined,
  }: FormattedPrintingOptions = {}) {
    let format = userDefined;
    if (!format) {
      try {
        const prettierFormat = loadPeer<{
          format: (txt: string, opt: { filepath: string }) => Promise<string>;
        }>("prettier").format;
        format = (text) => prettierFormat(text, { filepath: "client.ts" });
      } catch {}
      try {
        const oxFmt = loadPeer<typeof OxFmt>("oxfmt").format;
        format = async (text) => {
          const { code, errors } = await oxFmt("client.ts", text);
          if (errors.length) {
            throw new Error("OxFmt failed to format the code", {
              cause: errors,
            });
          }
          return code;
        };
      } catch {}
    }

    if (this.#usage && format) this.#usage = await format(this.#usage);
    const output = this.print(printerOptions);
    return format ? format(output) : output;
  }
}
