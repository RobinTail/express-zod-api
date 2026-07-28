/**
 * @fileOverview The entrypoint for generating Integration code
 * @requires typescript
 * */
export type { Producer } from "./zts-helpers";
import { z } from "zod";
import { responseVariants } from "./api-response";
import { IntegrationBase } from "./integration-base";
import { shouldHaveContent, makeCleanId } from "./common-helpers";
import { loadPeer } from "./peer-helpers";
import type { Routing } from "./routing";
import { ensureTypeNode, printNode, ts } from "./typescript-api";
import { walkRouting, withHead, type OnEndpoint } from "./routing-walker";
import type { HandlingRules } from "./schema-walker";
import { zodToTs } from "./zts";
import type { ZTSContext } from "./zts-helpers";
import type Prettier from "prettier";
import type { ClientMethod } from "./method";
import type { CommonConfig } from "./config-type";

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
}

interface FormattedPrintingOptions {
  /** @desc Typescript printer options */
  printerOptions?: ts.PrinterOptions;
  /**
   * @desc Typescript code formatter
   * @default prettier.format
   * */
  format?: (program: string) => Promise<string>;
}

export class Integration extends IntegrationBase {
  readonly #program: Array<string | ((opts?: ts.PrinterOptions) => string)> =
    [];
  readonly #aliases = new Map<object, string>();
  #usage?: string;

  #makeAlias(key: object, produce: () => ts.TypeNode): ts.TypeNode {
    let name = this.#aliases.get(key);
    if (!name) {
      name = `Type${this.#aliases.size + 1}`;
      this.#aliases.set(key, name);
      const node = produce();
      this.#program.push((opts) => `type ${name} = ${printNode(node, opts)};`);
    }
    return ensureTypeNode(name);
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
  }: IntegrationParams) {
    super(serverUrl);
    const commons = { makeAlias: this.#makeAlias.bind(this) };
    const ctxIn = { brandHandling, ctx: { ...commons, isResponse: false } };
    const ctxOut = { brandHandling, ctx: { ...commons, isResponse: true } };
    const onEndpoint: OnEndpoint<ClientMethod> = (method, path, endpoint) => {
      const entitle = makeCleanId.bind(null, method, path);
      const { isDeprecated, inputSchema, tags } = endpoint;
      const request = `${method} ${path}`;
      const inputTypeName = entitle("input");
      const inputTypeNode = zodToTs(inputSchema, ctxIn);
      this.#program.push(
        (opts) =>
          `/** ${request} */\ntype ${inputTypeName} = ${printNode(inputTypeNode, opts)};`,
      );
      const positiveBare: string[] = [];
      const negativeBare: string[] = [];
      const encodedTuples: string[] = [];
      for (const responseVariant of responseVariants) {
        const responses = endpoint.getResponses(responseVariant);
        const target =
          responseVariant === "positive" ? positiveBare : negativeBare;
        for (const [idx, { schema, mimeTypes, statusCodes }] of Array.from(
          responses.entries(),
        )) {
          const hasBody = shouldHaveContent(method, mimeTypes);
          const variantName = entitle(responseVariant, "variant", `${idx + 1}`);
          const variantTypeNode = zodToTs(
            hasBody ? schema : noBodySchema,
            ctxOut,
          );
          this.#program.push(
            (opts) =>
              `/** ${request} */\ntype ${variantName} = ${printNode(variantTypeNode, opts)};`,
          );
          for (const code of statusCodes) {
            target.push(variantName);
            encodedTuples.push(`[${code}, ${variantName}]`);
          }
        }
      }
      this.paths.add(path);
      const buildUnionOrSingle = (items: string[]) =>
        items.length === 1 ? items[0]! : items.join(" | ");
      const store = {
        input: inputTypeName,
        positive: buildUnionOrSingle(positiveBare),
        negative: buildUnionOrSingle(negativeBare),
        encoded: buildUnionOrSingle(encodedTuples),
      };
      this.registry.set(request, { isDeprecated, store });
      this.tags.set(request, tags);
    };
    walkRouting({
      routing,
      config,
      onEndpoint: hasHeadMethod ? withHead(onEndpoint) : onEndpoint,
    });
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
      this.makeDefaultImplementation(),
      this.makeClientClass(clientClassName),
      this.makeSubscriptionClass(subscriptionClassName),
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
        const prettierFormat = loadPeer<typeof Prettier>("prettier").format;
        format = (text) => prettierFormat(text, { filepath: "client.ts" });
      } catch {}
    }

    if (this.#usage && format) this.#usage = await format(this.#usage);
    const output = this.print(printerOptions);
    return format ? format(output) : output;
  }
}
