import * as R from "ramda";
import type ts from "typescript";
import { z } from "zod";
import { ResponseVariant, responseVariants } from "./api-response";
import { IntegrationBase } from "./integration-base";
import { shouldHaveContent, makeCleanId } from "./common-helpers";
import { loadPeer } from "./peer-helpers";
import { Routing } from "./routing";
import { OnEndpoint, walkRouting, withHead } from "./routing-walker";
import { HandlingRules } from "./schema-walker";
import { TypescriptAPI } from "./typescript-api";
import { zodToTs } from "./zts";
import { ZTSContext } from "./zts-helpers";
import type Prettier from "prettier";
import { ClientMethod } from "./method";
import type { CommonConfig } from "./config-type";

interface IntegrationParams {
  typescript: typeof ts;
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
  noContent?: z.ZodType;
  /**
   * @desc Depict the HEAD method for each Endpoint supporting the GET method (feature of Express)
   * @default true
   * */
  hasHeadMethod?: boolean;
  /**
   * @desc Handling rules for your own branded schemas.
   * @desc Keys: brands (recommended to use unique symbols).
   * @desc Values: functions having schema as first argument that you should assign type to, second one is a context.
   * @example { MyBrand: ( schema: typeof myBrandSchema, { next } ) => createKeywordTypeNode(SyntaxKind.AnyKeyword)
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
  readonly #program: ts.Node[] = [this.makeSomeOfType()];
  readonly #aliases = new Map<object, ts.TypeAliasDeclaration>();
  #usage: Array<ts.Node | string> = [];

  #makeAlias(key: object, produce: () => ts.TypeNode): ts.TypeNode {
    let name = this.#aliases.get(key)?.name?.text;
    if (!name) {
      name = `Type${this.#aliases.size + 1}`;
      const temp = this.api.makeLiteralType(null);
      this.#aliases.set(key, this.api.makeType(name, temp));
      this.#aliases.set(key, this.api.makeType(name, produce()));
    }
    return this.api.ensureTypeNode(name);
  }

  public constructor({
    typescript,
    routing,
    config,
    brandHandling,
    variant = "client",
    clientClassName = "Client",
    subscriptionClassName = "Subscription",
    serverUrl = "https://example.com",
    noContent = z.undefined(),
    hasHeadMethod = true,
  }: IntegrationParams) {
    super(new TypescriptAPI(typescript), serverUrl);
    const commons = { makeAlias: this.#makeAlias.bind(this), api: this.api };
    const ctxIn = { brandHandling, ctx: { ...commons, isResponse: false } };
    const ctxOut = { brandHandling, ctx: { ...commons, isResponse: true } };
    const onEndpoint: OnEndpoint<ClientMethod> = (method, path, endpoint) => {
      const entitle = makeCleanId.bind(null, method, path); // clean id with method+path prefix
      const { isDeprecated, inputSchema, tags } = endpoint;
      const request = `${method} ${path}`;
      const input = this.api.makeType(
        entitle("input"),
        zodToTs(inputSchema, ctxIn),
        { comment: request },
      );
      this.#program.push(input);
      const dictionaries = responseVariants.reduce(
        (agg, responseVariant) => {
          const responses = endpoint.getResponses(responseVariant);
          const props = R.chain(([idx, { schema, mimeTypes, statusCodes }]) => {
            const hasContent = shouldHaveContent(method, mimeTypes);
            const variantType = this.api.makeType(
              entitle(responseVariant, "variant", `${idx + 1}`),
              zodToTs(hasContent ? schema : noContent, ctxOut),
              { comment: request },
            );
            this.#program.push(variantType);
            return statusCodes.map((code) =>
              this.api.makeInterfaceProp(code, variantType.name),
            );
          }, Array.from(responses.entries()));
          const dict = this.api.makeInterface(
            entitle(responseVariant, "response", "variants"),
            props,
            { comment: request },
          );
          this.#program.push(dict);
          return Object.assign(agg, { [responseVariant]: dict });
        },
        {} as Record<ResponseVariant, ts.TypeAliasDeclaration>,
      );
      this.paths.add(path);
      const literalIdx = this.api.makeLiteralType(request);
      const store = {
        input: this.api.ensureTypeNode(input.name),
        positive: this.someOf(dictionaries.positive),
        negative: this.someOf(dictionaries.negative),
        response: this.api.makeUnion([
          this.api.makeIndexed(this.interfaces.positive, literalIdx),
          this.api.makeIndexed(this.interfaces.negative, literalIdx),
        ]),
        encoded: this.api.f.createIntersectionTypeNode([
          this.api.ensureTypeNode(dictionaries.positive.name),
          this.api.ensureTypeNode(dictionaries.negative.name),
        ]),
      };
      this.registry.set(request, { isDeprecated, store });
      this.tags.set(request, tags);
    };
    walkRouting({
      routing,
      config,
      onEndpoint: hasHeadMethod ? withHead(onEndpoint) : onEndpoint,
    });
    this.#program.unshift(...this.#aliases.values());
    this.#program.push(
      this.makePathType(),
      this.makeMethodType(),
      ...this.makePublicInterfaces(),
      this.requestType,
    );

    if (variant === "types") return;

    this.#program.push(
      this.makeEndpointTags(),
      this.makeParseRequestFn(),
      this.makeSubstituteFn(),
      this.makeImplementationType(),
      this.makeDefaultImplementation(),
      this.makeClientClass(clientClassName),
      this.makeSubscriptionClass(subscriptionClassName),
    );

    this.#usage.push(
      ...this.makeUsageStatements(clientClassName, subscriptionClassName),
    );
  }

  public static async create(params: Omit<IntegrationParams, "typescript">) {
    return new Integration({
      ...params,
      typescript: await loadPeer<typeof ts>("typescript"),
    });
  }

  #printUsage(printerOptions?: ts.PrinterOptions) {
    return this.#usage.length
      ? this.#usage
          .map((entry) =>
            typeof entry === "string"
              ? entry
              : this.api.printNode(entry, printerOptions),
          )
          .join("\n")
      : undefined;
  }

  public print(printerOptions?: ts.PrinterOptions) {
    const usageExampleText = this.#printUsage(printerOptions);
    const commentNode =
      usageExampleText &&
      this.api.ts.addSyntheticLeadingComment(
        this.api.ts.addSyntheticLeadingComment(
          this.api.f.createEmptyStatement(),
          this.api.ts.SyntaxKind.SingleLineCommentTrivia,
          " Usage example:",
        ),
        this.api.ts.SyntaxKind.MultiLineCommentTrivia,
        `\n${usageExampleText}`,
      );
    return this.#program
      .concat(commentNode || [])
      .map((node, index) =>
        this.api.printNode(
          node,
          index < this.#program.length
            ? printerOptions
            : { ...printerOptions, omitTrailingSemicolon: true },
        ),
      )
      .join("\n\n");
  }

  public async printFormatted({
    printerOptions,
    format: userDefined,
  }: FormattedPrintingOptions = {}) {
    let format = userDefined;
    if (!format) {
      try {
        const prettierFormat = (await loadPeer<typeof Prettier>("prettier"))
          .format;
        format = (text) => prettierFormat(text, { filepath: "client.ts" });
      } catch {}
    }

    const usageExample = this.#printUsage(printerOptions);
    this.#usage =
      usageExample && format ? [await format(usageExample)] : this.#usage;

    const output = this.print(printerOptions);
    return format ? format(output) : output;
  }
}
