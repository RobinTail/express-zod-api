import { chain } from "ramda";
import ts from "typescript";
import { z } from "zod";
import { ResponseVariant, responseVariants } from "./api-response";
import { IntegrationBase } from "./integration-base";
import {
  f,
  makeInterfaceProp,
  makeInterface,
  makePublicLiteralType,
  makeType,
  makePropertyIdentifier,
  printNode,
} from "./typescript-api";
import { makeCleanId } from "./common-helpers";
import { loadPeer } from "./peer-helpers";
import { Routing } from "./routing";
import { OnEndpoint, walkRouting } from "./routing-walker";
import { HandlingRules } from "./schema-walker";
import { zodToTs } from "./zts";
import { ZTSContext } from "./zts-helpers";
import type Prettier from "prettier";

type IOKind = "input" | "response" | ResponseVariant | "encoded";

interface IntegrationParams {
  routing: Routing;
  /**
   * @desc What should be generated
   * @example "types" — types of your endpoint requests and responses (for a DIY solution)
   * @example "client" — an entity for performing typed requests and receiving typed responses
   * @default "client"
   * */
  variant?: "types" | "client";
  /**
   * @desc The API URL to use in the generated code
   * @default https://example.com
   * */
  serverUrl?: string;
  /**
   * @desc configures the style of object's optional properties
   * @default { withQuestionMark: true, withUndefined: true }
   */
  optionalPropStyle?: {
    /**
     * @desc add question mark to the optional property definition
     * @example { someProp?: boolean }
     * */
    withQuestionMark?: boolean;
    /**
     * @desc add undefined to the property union type
     * @example { someProp: boolean | undefined }
     */
    withUndefined?: boolean;
  };
  /**
   * @desc The schema to use for responses without body such as 204
   * @default z.undefined()
   * */
  noContent?: z.ZodTypeAny;
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
  protected program: ts.Node[] = [this.someOfType];
  protected usage: Array<ts.Node | string> = [];
  protected registry = new Map<
    string, // request (method+path)
    Record<IOKind, ts.TypeNode> & { tags: ReadonlyArray<string> }
  >();
  protected paths = new Set<string>();
  protected aliases = new Map<z.ZodTypeAny, ts.TypeAliasDeclaration>();
  protected interfaces: Array<{
    id: ts.Identifier;
    kind: IOKind;
    props: ts.PropertySignature[];
  }> = [
    { id: this.ids.inputInterface, kind: "input", props: [] },
    { id: this.ids.posResponseInterface, kind: "positive", props: [] },
    { id: this.ids.negResponseInterface, kind: "negative", props: [] },
    { id: this.ids.encResponseInterface, kind: "encoded", props: [] },
    { id: this.ids.responseInterface, kind: "response", props: [] },
  ];

  protected makeAlias(
    schema: z.ZodTypeAny,
    produce: () => ts.TypeNode,
  ): ts.TypeReferenceNode {
    let name = this.aliases.get(schema)?.name?.text;
    if (!name) {
      name = `Type${this.aliases.size + 1}`;
      const temp = f.createLiteralTypeNode(f.createNull());
      this.aliases.set(schema, makeType(name, temp));
      this.aliases.set(schema, makeType(name, produce()));
    }
    return f.createTypeReferenceNode(name);
  }

  public constructor({
    routing,
    brandHandling,
    variant = "client",
    serverUrl = "https://example.com",
    optionalPropStyle = { withQuestionMark: true, withUndefined: true },
    noContent = z.undefined(),
  }: IntegrationParams) {
    super();
    const commons = { makeAlias: this.makeAlias.bind(this), optionalPropStyle };
    const ctxIn = { brandHandling, ctx: { ...commons, isResponse: false } };
    const ctxOut = { brandHandling, ctx: { ...commons, isResponse: true } };
    const onEndpoint: OnEndpoint = (endpoint, path, method) => {
      const entitle = makeCleanId.bind(null, method, path); // clean id with method+path prefix
      const request = `${method} ${path}`;
      const input = makeType(
        entitle("input"),
        zodToTs(endpoint.getSchema("input"), ctxIn),
        { comment: request },
      );
      this.program.push(input);
      const dictionaries = responseVariants.reduce(
        (agg, responseVariant) => {
          const responses = endpoint.getResponses(responseVariant);
          const props = chain(([idx, { schema, mimeTypes, statusCodes }]) => {
            const variantType = makeType(
              entitle(responseVariant, "variant", `${idx + 1}`),
              zodToTs(mimeTypes ? schema : noContent, ctxOut),
              { comment: request },
            );
            this.program.push(variantType);
            return statusCodes.map((code) =>
              makeInterfaceProp(
                code,
                f.createTypeReferenceNode(variantType.name),
              ),
            );
          }, Array.from(responses.entries()));
          const dict = makeInterface(
            entitle(responseVariant, "response", "variants"),
            props,
            { comment: request },
          );
          this.program.push(dict);
          return Object.assign(agg, { [responseVariant]: dict });
        },
        {} as Record<ResponseVariant, ts.TypeAliasDeclaration>,
      );
      this.paths.add(path);
      const literalIdx = f.createLiteralTypeNode(
        f.createStringLiteral(request),
      );
      this.registry.set(request, {
        input: f.createTypeReferenceNode(input.name),
        positive: this.someOf(dictionaries.positive),
        negative: this.someOf(dictionaries.negative),
        response: f.createUnionTypeNode([
          f.createIndexedAccessTypeNode(
            f.createTypeReferenceNode(this.ids.posResponseInterface),
            literalIdx,
          ),
          f.createIndexedAccessTypeNode(
            f.createTypeReferenceNode(this.ids.negResponseInterface),
            literalIdx,
          ),
        ]),
        encoded: f.createIntersectionTypeNode([
          f.createTypeReferenceNode(dictionaries.positive.name),
          f.createTypeReferenceNode(dictionaries.negative.name),
        ]),
        tags: endpoint.getTags(),
      });
    };
    walkRouting({ routing, onEndpoint });
    this.program.unshift(...this.aliases.values());

    // export type Path = "/v1/user/retrieve" | ___;
    this.program.push(
      makePublicLiteralType(this.ids.pathType, Array.from(this.paths)),
    );

    this.program.push(this.methodType);

    // Single walk through the registry for making properties for the next three objects
    const endpointTags: ts.PropertyAssignment[] = [];
    for (const [request, { tags, ...rest }] of this.registry) {
      // "get /v1/user/retrieve": GetV1UserRetrieveInput
      for (const face of this.interfaces)
        face.props.push(makeInterfaceProp(request, rest[face.kind]));
      if (variant !== "types") {
        // "get /v1/user/retrieve": ["users"]
        endpointTags.push(
          f.createPropertyAssignment(
            makePropertyIdentifier(request),
            f.createArrayLiteralExpression(
              tags.map((tag) => f.createStringLiteral(tag)),
            ),
          ),
        );
      }
    }

    // export interface Input { "get /v1/user/retrieve": GetV1UserRetrieveInput; }
    for (const { id, props } of this.interfaces)
      this.program.push(makeInterface(id, props, { expose: true }));

    this.program.push(this.requestType);

    if (variant === "types") return;

    this.program.push(
      this.makeEndpointTagsConst(endpointTags),
      this.makeImplementationType(),
      this.makeClientClass(),
    );

    this.usage.push(
      this.makeExampleImplementation(serverUrl),
      ...this.makeUsageStatements(),
    );
  }

  protected printUsage(printerOptions?: ts.PrinterOptions) {
    return this.usage.length
      ? this.usage
          .map((entry) =>
            typeof entry === "string"
              ? entry
              : printNode(entry, printerOptions),
          )
          .join("\n")
      : undefined;
  }

  public print(printerOptions?: ts.PrinterOptions) {
    const usageExampleText = this.printUsage(printerOptions);
    const commentNode =
      usageExampleText &&
      ts.addSyntheticLeadingComment(
        ts.addSyntheticLeadingComment(
          f.createEmptyStatement(),
          ts.SyntaxKind.SingleLineCommentTrivia,
          " Usage example:",
        ),
        ts.SyntaxKind.MultiLineCommentTrivia,
        `\n${usageExampleText}`,
      );
    return this.program
      .concat(commentNode || [])
      .map((node, index) =>
        printNode(
          node,
          index < this.program.length
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

    const usageExample = this.printUsage(printerOptions);
    this.usage =
      usageExample && format ? [await format(usageExample)] : this.usage;

    const output = this.print(printerOptions);
    return format ? format(output) : output;
  }
}
