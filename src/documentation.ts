import { z } from "zod";
import {
  defaultInputSources,
  defaultSerializer,
  makeCleanId,
} from "./common-helpers";
import { CommonConfig } from "./config-type";
import {
  depictRequest,
  depictRequestParams,
  depictResponse,
  depictSecurity,
  depictSecurityRefs,
  depictTags,
  ensureShortDescription,
  reformatParamsInPath,
} from "./documentation-helpers";
import { OpenAPIError } from "./errors";
import { mapLogicalContainer } from "./logical-container";
import { Method } from "./method";
import {
  OASVersion,
  OpenApiBuilder,
  OperationObject,
  ReferenceObject,
  SchemaObject,
  SecuritySchemeObject,
  SecuritySchemeType,
  isOpenApiBuilder30,
  isOpenApiBuilder31,
  isSchemaObject30,
  isSchemaObject31,
  makeBuilder,
} from "./oas-domain";
import { Routing } from "./routing";
import { RoutingWalkerParams, walkRouting } from "./routing-walker";

interface DocumentationParams {
  /**
   * Version of the OpenAPI specification
   * @default 3.0
   * */
  variant?: OASVersion;
  title: string;
  /** Version of the generated documentation */
  version: string;
  serverUrl: string;
  routing: Routing;
  config: CommonConfig;
  /** @default Successful response */
  successfulResponseDescription?: string;
  /** @default Error response */
  errorResponseDescription?: string;
  /** @default true */
  hasSummaryFromDescription?: boolean;
  /** @default inline */
  composition?: "inline" | "components";
  /**
   * @desc Used for comparing schemas wrapped into z.lazy() to limit the recursion
   * @default JSON.stringify() + SHA1 hash as a hex digest
   * */
  serializer?: (schema: z.ZodTypeAny) => string;
}

export class Documentation {
  public builder: OpenApiBuilder;
  protected lastSecuritySchemaIds: Partial<Record<SecuritySchemeType, number>> =
    {};
  protected lastOperationIdSuffixes: Record<string, number> = {};

  protected makeRef(
    name: string,
    schema: SchemaObject | ReferenceObject
  ): ReferenceObject {
    if (isOpenApiBuilder31(this.builder) && isSchemaObject31(schema)) {
      this.builder.addSchema(name, schema);
    } else if (isOpenApiBuilder30(this.builder) && isSchemaObject30(schema)) {
      this.builder.addSchema(name, schema);
    } else {
      throw new OpenAPIError(
        "Incompatible types met in Documentation::makeRef"
      );
    }
    return this.getRef(name)!;
  }

  protected getRef(name: string): ReferenceObject | undefined {
    return name in (this.builder.rootDoc.components?.schemas || {})
      ? { $ref: `#/components/schemas/${name}` }
      : undefined;
  }

  protected ensureUniqOperationId(path: string, method: Method) {
    const operationId = makeCleanId(path, method);
    if (operationId in this.lastOperationIdSuffixes) {
      this.lastOperationIdSuffixes[operationId]++;
      return `${operationId}${this.lastOperationIdSuffixes[operationId]}`;
    }
    this.lastOperationIdSuffixes[operationId] = 1;
    return operationId;
  }

  protected ensureUniqSecuritySchemaName(subject: SecuritySchemeObject) {
    const serializedSubject = JSON.stringify(subject);
    for (const name in this.builder.rootDoc.components?.securitySchemes || {}) {
      if (
        serializedSubject ===
        JSON.stringify(this.builder.rootDoc.components?.securitySchemes?.[name])
      ) {
        return name;
      }
    }
    this.lastSecuritySchemaIds[subject.type] =
      (this.lastSecuritySchemaIds?.[subject.type] || 0) + 1;
    return `${subject.type.toUpperCase()}_${
      this.lastSecuritySchemaIds[subject.type]
    }`;
  }

  public constructor({
    routing,
    config,
    title,
    version,
    serverUrl,
    successfulResponseDescription = "Successful response",
    errorResponseDescription = "Error response",
    hasSummaryFromDescription = true,
    composition = "inline",
    serializer = defaultSerializer,
    variant = "3.0",
  }: DocumentationParams) {
    this.builder = makeBuilder(variant);
    this.builder.addOpenApiVersion(`${variant}.0`);
    this.builder.addInfo({ title, version }).addServer({ url: serverUrl });
    const onEndpoint: RoutingWalkerParams["onEndpoint"] = (
      endpoint,
      path,
      _method
    ) => {
      const method = _method as Method;
      const commonParams = {
        path,
        method,
        endpoint,
        composition,
        serializer,
        getRef: this.getRef.bind(this),
        makeRef: this.makeRef.bind(this),
        version: variant,
      };
      const [shortDesc, longDesc] = (["short", "long"] as const).map(
        endpoint.getDescription.bind(endpoint)
      );
      const inputSources =
        config.inputSources?.[method] || defaultInputSources[method];
      const depictedParams = depictRequestParams({
        ...commonParams,
        inputSources,
      });
      const operation: OperationObject = {
        operationId: this.ensureUniqOperationId(path, method),
        responses: {
          [endpoint.getStatusCode("positive")]: depictResponse({
            ...commonParams,
            clue: successfulResponseDescription,
            isPositive: true,
          }),
          [endpoint.getStatusCode("negative")]: depictResponse({
            ...commonParams,
            clue: errorResponseDescription,
            isPositive: false,
          }),
        },
      };
      if (longDesc) {
        operation.description = longDesc;
        if (hasSummaryFromDescription && shortDesc === undefined) {
          operation.summary = ensureShortDescription(longDesc);
        }
      }
      if (shortDesc) {
        operation.summary = ensureShortDescription(shortDesc);
      }
      if (endpoint.getTags().length > 0) {
        operation.tags = endpoint.getTags();
      }
      if (depictedParams.length > 0) {
        // @todo fix it
        // @ts-ignore
        operation.parameters = depictedParams;
      }
      if (inputSources.includes("body")) {
        operation.requestBody = depictRequest(commonParams);
      }
      const securityRefs = depictSecurityRefs(
        mapLogicalContainer(
          depictSecurity(endpoint.getSecurity()),
          (securitySchema) => {
            const name = this.ensureUniqSecuritySchemaName(securitySchema);
            const scopes = ["oauth2", "openIdConnect"].includes(
              securitySchema.type
            )
              ? endpoint.getScopes()
              : [];
            this.builder.addSecurityScheme(name, securitySchema);
            return { name, scopes };
          }
        )
      );
      if (securityRefs.length > 0) {
        operation.security = securityRefs;
      }
      const swaggerCompatiblePath = reformatParamsInPath(path);
      this.builder.addPath(swaggerCompatiblePath, {
        [method]: operation,
      });
    };
    walkRouting({ routing, onEndpoint });
    this.builder.rootDoc.tags = config.tags ? depictTags(config.tags) : [];
  }

  /** @see Documentation.builder */
  public getSpecAsYaml() {
    return this.builder.getSpecAsYaml();
  }
}

/**
 * @deprecated Use Documentation instead.
 * @todo remove in v11
 * */
export class OpenAPI extends Documentation {}
