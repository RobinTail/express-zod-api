import {
  type ExamplesObject,
  type MediaTypeObject,
  type OAuthFlowObject,
  type ParameterLocation,
  type ParameterObject,
  type ReferenceObject,
  type RequestBodyObject,
  type ResponseObject,
  type SchemaObjectType,
  type SchemaObjectValue,
  type SecurityRequirementObject,
  type SecuritySchemeObject,
  type SecuritySchemeType,
  type TagObject,
  isReferenceObject,
  isSchemaObject,
} from "openapi3-ts/oas32";
import * as R from "ramda";
import { z } from "zod";
import type { NormalizedResponse, ResponseVariant } from "./api-response";
import { ezBufferBrand } from "./buffer-schema";
import {
  type FlatObject,
  type Tag,
  shouldHaveContent,
  getRoutePathParams,
  getTransformedType,
  isObject,
  isSchema,
  makeCleanId,
  routePathParamsRegex,
  ucFirst,
} from "./common-helpers";
import type { InputSource } from "./config-type";
import { contentTypes } from "./content-type";
import { ezDateInBrand } from "./date-in-schema";
import { ezDateOutBrand } from "./date-out-schema";
import { DocumentationError } from "./errors";
import type { IOSchema } from "./io-schema";
import { flattenIO, type FlattenObjectSchema } from "./json-schema-helpers";
import type { Alternatives, LogicalContainer } from "./logical-container";
import { getBrand } from "./metadata";
import type { ClientMethod } from "./method";
import type { ProprietaryBrand } from "./proprietary-schemas";
import { ezRawBrand } from "./raw-schema";
import type { FirstPartyKind } from "./schema-walker";
import { getSecurityNames, type Security } from "./security";
import { ezUploadBrand } from "./upload-schema";
import { getWellKnownHeaders } from "./well-known-headers";

interface ReqResCommons {
  makeRef: (
    key: object | string,
    value: SchemaObjectValue | ReferenceObject,
    proposedName?: string,
  ) => ReferenceObject;
  path: string;
  method: ClientMethod;
  seenIds: Map<string, z.core.$ZodType>;
}

export interface OpenAPIContext extends ReqResCommons {
  isResponse: boolean;
}

export type Depicter = (
  zodCtx: {
    zodSchema: z.core.$ZodType;
    jsonSchema: z.core.JSONSchema.BaseSchema;
  },
  oasCtx: OpenAPIContext,
) => z.core.JSONSchema.BaseSchema | SchemaObjectValue;

/** @desc Using defaultIsHeader when returns null or undefined */
export type IsHeader = (
  name: string,
  method: ClientMethod,
  path: string,
) => boolean | null | undefined;

export type BrandHandling = Record<string | symbol, Depicter>;

const samples = {
  integer: 0,
  number: 0,
  string: "",
  boolean: false,
  object: {},
  null: null,
  array: [],
} satisfies Record<SchemaObjectType, unknown>;

export const reformatParamsInPath = (path: string) =>
  path.replace(routePathParamsRegex, (param) => `{${param.slice(1)}}`);

export const depictUpload: Depicter = ({}, ctx) => {
  if (ctx.isResponse)
    throw new DocumentationError("Please use ez.upload() only for input.", ctx);
  return { type: "string", format: "binary" };
};

export const depictBuffer: Depicter = ({ jsonSchema }) => ({
  ...jsonSchema,
  externalDocs: {
    description: "raw binary data",
    url: "https://swagger.io/specification/#working-with-binary-data",
  },
});

export const depictUnion: Depicter = ({ zodSchema, jsonSchema }) => {
  if (
    !isSchema<z.core.$ZodUnion | z.core.$ZodDiscriminatedUnion>(
      zodSchema,
      "union",
    )
  )
    return jsonSchema;
  if (!("discriminator" in zodSchema._zod.def)) return jsonSchema;
  const propertyName: string = zodSchema._zod.def.discriminator;
  return {
    ...jsonSchema,
    discriminator: jsonSchema.discriminator ?? { propertyName },
  };
};

export const depictIntersection = R.tryCatch<Depicter>(
  ({ jsonSchema }) => {
    if (!jsonSchema.allOf) throw "no allOf";
    return flattenIO(jsonSchema, "throw");
  },
  (_err, { jsonSchema }) => jsonSchema,
);

/** @since OAS 3.1 nullable replaced with type array having null */
export const depictNullable: Depicter = ({ jsonSchema }) => {
  if (!jsonSchema.anyOf || !jsonSchema.anyOf.length) return jsonSchema;
  const original = jsonSchema.anyOf[0]!;
  return Object.assign(original, { type: makeNullableType(original.type) });
};

/** @since v24.3.1 schema compliance is fully delegated to Zod */
const asOAS = (subject: z.core.JSONSchema.BaseSchema) =>
  subject as SchemaObjectValue | ReferenceObject;

export const depictDateIn: Depicter = ({ jsonSchema }, ctx) => {
  if (ctx.isResponse)
    throw new DocumentationError("Please use ez.dateOut() for output.", ctx);
  return jsonSchema;
};

export const depictDateOut: Depicter = ({ jsonSchema }, ctx) => {
  if (!ctx.isResponse)
    throw new DocumentationError("Please use ez.dateIn() for input.", ctx);
  return jsonSchema;
};

export const depictBigInt: Depicter = () => ({
  type: "string",
  format: "bigint",
  pattern: /^-?\d+$/.source,
});

/**
 * @since OAS 3.1 using prefixItems for depicting tuples
 * @since 17.5.0 added rest handling, fixed tuple type
 */
export const depictTuple: Depicter = ({ zodSchema, jsonSchema }) => {
  if ((zodSchema as z.core.$ZodTuple)._zod.def.rest !== null) return jsonSchema;
  // does not appear to support items:false, so not:{} is a recommended alias
  return { ...jsonSchema, items: { not: {} } };
};

const makeSample = (depicted: SchemaObjectValue) => {
  const firstType = (
    Array.isArray(depicted.type) ? depicted.type[0] : depicted.type
  ) as keyof typeof samples;
  return samples?.[firstType];
};

/** @since v24.0.0 does not return null for undefined */
const makeNullableType = (
  current:
    | z.core.JSONSchema.BaseSchema["type"]
    | Array<NonNullable<z.core.JSONSchema.BaseSchema["type"]>>,
): typeof current => {
  if (current === ("null" satisfies SchemaObjectType)) return current;
  if (typeof current === "string")
    return [current, "null" satisfies SchemaObjectType];
  return (
    current && [...new Set(current).add("null" satisfies SchemaObjectType)]
  );
};

const typeofCompatible = new Set<ReturnType<typeof getTransformedType>>([
  "number",
  "string",
  "boolean",
] satisfies SchemaObjectType[]);
export const depictPipeline: Depicter = ({ zodSchema, jsonSchema }, ctx) => {
  const target = (zodSchema as z.core.$ZodPipe)._zod.def[
    ctx.isResponse ? "out" : "in"
  ];
  const opposite = (zodSchema as z.core.$ZodPipe)._zod.def[
    ctx.isResponse ? "in" : "out"
  ];
  if (!isSchema<z.core.$ZodTransform>(target, "transform")) return jsonSchema;
  const opposingDepiction = asOAS(depict(opposite, { ctx }));
  if (isSchemaObject(opposingDepiction)) {
    if (!ctx.isResponse) {
      const { type: opposingType, ...rest } = opposingDepiction;
      return {
        ...rest,
        format: `${rest.format || opposingType} (preprocessed)`,
      };
    } else {
      const targetType = getTransformedType(
        target,
        makeSample(opposingDepiction),
      );
      if (targetType && typeofCompatible.has(targetType))
        return { ...jsonSchema, type: targetType as SchemaObjectType };
    }
  }
  return jsonSchema;
};

export const depictRaw: Depicter = ({ jsonSchema }) => {
  if (jsonSchema.type !== "object") return jsonSchema;
  const objSchema = jsonSchema as z.core.JSONSchema.ObjectSchema;
  if (!objSchema.properties) return jsonSchema;
  if (!("raw" in objSchema.properties)) return jsonSchema;
  if (!isObject(objSchema.properties.raw)) return jsonSchema;
  return objSchema.properties.raw;
};

const enumerateExamples = (examples: unknown[]): ExamplesObject | undefined =>
  examples.length
    ? R.fromPairs(
        R.zip(
          R.times((idx) => `example${idx + 1}`, examples.length),
          R.map(R.objOf("dataValue"), examples),
        ),
      )
    : undefined;

export const defaultIsHeader = (
  name: string,
  familiar?: Set<string>,
): boolean =>
  familiar?.has(name) ||
  name.startsWith("x-") ||
  getWellKnownHeaders().has(name);

export const makeParamLocator = ({
  method,
  path,
  security,
  inputSources,
  isHeader,
}: {
  method: ClientMethod;
  path: string;
  security?: LogicalContainer<Security>[];
  inputSources: InputSource[];
  isHeader?: IsHeader;
}) => {
  const pathParams = new Set(getRoutePathParams(path));
  const isQueryEnabled = inputSources.includes("query");
  const areParamsEnabled = inputSources.includes("params");
  const areHeadersEnabled = inputSources.includes("headers");
  const areCookiesEnabled =
    inputSources.includes("cookies") || inputSources.includes("signedCookies");
  let securityHeaders: Set<string> | undefined;
  if (areHeadersEnabled && security)
    securityHeaders = getSecurityNames(security, "header");
  let securityCookies: Set<string> | undefined;
  if (areCookiesEnabled && security)
    securityCookies = getSecurityNames(security, "cookie");
  /** @modifies pathParams when the parameter's location is "path" */
  const getLocation = (name: string): ParameterLocation | undefined => {
    if (areParamsEnabled && pathParams.has(name) && pathParams.delete(name))
      return "path";
    if (areCookiesEnabled && securityCookies?.has(name)) return "cookie";
    if (
      areHeadersEnabled &&
      (isHeader?.(name, method, path) ?? defaultIsHeader(name, securityHeaders))
    )
      return "header";
    if (isQueryEnabled) return "query";
    if (areCookiesEnabled) return "cookie";
  };
  return { pathParams, getLocation, isQueryEnabled };
};

export const depictRequestParams = ({
  path,
  method,
  flatRequest,
  makeRef,
  composition,
  getLocation,
  description = `${method.toUpperCase()} ${path} Parameter`,
}: ReqResCommons & {
  composition: "inline" | "components";
  description?: string;
  flatRequest: FlattenObjectSchema;
  getLocation: (name: string) => ParameterLocation | undefined;
}) => {
  const depictedParams: ParameterObject[] = [];
  for (const [name, jsonSchema] of Object.entries(flatRequest.properties)) {
    if (!isObject(jsonSchema)) continue;
    const location = getLocation(name);
    if (!location) continue;
    const depicted = asOAS(jsonSchema);
    const result =
      composition === "components"
        ? makeRef(
            jsonSchema.id || JSON.stringify(jsonSchema),
            depicted,
            jsonSchema.id || makeCleanId(description, name),
          )
        : depicted;
    depictedParams.push({
      name,
      in: location,
      deprecated: jsonSchema.deprecated,
      required: flatRequest.required?.includes(name) || location === "path", // issue #3600
      description: depicted.description || description,
      schema: result,
      examples: enumerateExamples(
        isSchemaObject(depicted) && depicted.examples?.length
          ? depicted.examples // own examples or from the flat:
          : R.pluck(
              name,
              flatRequest.examples?.filter(R.both(isObject, R.has(name))) || [],
            ),
      ),
    });
  }
  return depictedParams;
};

const depicters: Partial<Record<FirstPartyKind | ProprietaryBrand, Depicter>> =
  {
    nullable: depictNullable,
    union: depictUnion,
    bigint: depictBigInt,
    intersection: depictIntersection,
    tuple: depictTuple,
    pipe: depictPipeline,
    [ezDateInBrand]: depictDateIn,
    [ezDateOutBrand]: depictDateOut,
    [ezUploadBrand]: depictUpload,
    [ezRawBrand]: depictRaw,
    [ezBufferBrand]: depictBuffer,
  };

/**
 * Changes references relative to a schema root into the ones relative to a document root
 * @link https://github.com/colinhacks/zod/issues/4281
 * */
const fixReferences = (
  subject: z.core.JSONSchema.BaseSchema,
  defs: Record<string, z.core.JSONSchema.BaseSchema>,
  ctx: OpenAPIContext,
) => {
  const stack: unknown[] = [subject, defs];
  const filterNaming = (name: string) =>
    /schema\d+$/.test(name) ? undefined : name;
  for (let idx = 0; idx < stack.length; idx++) {
    const entry = stack[idx];
    if (R.is(Object, entry)) {
      if (isReferenceObject(entry) && !entry.$ref.startsWith("#/components")) {
        const actualName = entry.$ref.split("/").pop()!;
        const depiction = defs[actualName];
        if (depiction) {
          const cacheKey = depiction.id || filterNaming(actualName);
          entry.$ref = ctx.makeRef(
            cacheKey || depiction, // avoiding serialization because changing $ref
            asOAS(depiction),
            cacheKey,
          ).$ref;
        }
        continue;
      }
      stack.push(...R.values(entry));
    }
    if (R.is(Array, entry)) stack.push(...R.values(entry));
  }
  return subject;
};

const depict = (
  subject: z.core.$ZodType,
  { ctx, rules = depicters }: { ctx: OpenAPIContext; rules?: BrandHandling },
) => {
  const { $defs = {}, properties = {} } = z.toJSONSchema(
    z.object({ subject }), // avoiding "document root" references
    {
      unrepresentable: "any",
      io: ctx.isResponse ? "output" : "input",
      override: (zodCtx) => {
        const id = z.globalRegistry.get(zodCtx.zodSchema)?.id;
        if (id) {
          const familiar = ctx.seenIds.get(id);
          if (familiar && familiar !== zodCtx.zodSchema) {
            throw new DocumentationError(
              `The meta id "${id}" is used by two different schemas. ` +
                "Please make the ids unique or reuse the same schema instance.",
              ctx,
            );
          }
          ctx.seenIds.set(id, zodCtx.zodSchema);
        }
        const brand = getBrand(zodCtx.zodSchema);
        const depicter =
          rules[
            brand && brand in rules ? brand : zodCtx.zodSchema._zod.def.type
          ];
        if (depicter) {
          const overrides = { ...depicter(zodCtx, ctx) };
          for (const key in zodCtx.jsonSchema) delete zodCtx.jsonSchema[key];
          Object.assign(zodCtx.jsonSchema, overrides);
        }
      },
    },
  ) as z.core.JSONSchema.ObjectSchema;
  return fixReferences(
    isObject(properties["subject"]) ? properties["subject"] : {},
    $defs,
    ctx,
  );
};

export const excludeParamsFromDepiction = (
  subject: z.core.JSONSchema.BaseSchema,
  names: string[],
): [typeof subject, boolean] => {
  if (isReferenceObject(subject)) return [subject, false];
  let hasRequired = false;
  const subTransformer = R.map((entry: typeof subject) => {
    const [sub, subRequired] = excludeParamsFromDepiction(entry, names);
    hasRequired = hasRequired || subRequired;
    return sub;
  });
  const remover = R.omit(names) as <T>(obj: T) => Partial<T>;
  const transformers = {
    properties: remover,
    examples: R.map(remover),
    required: R.without(names),
    allOf: subTransformer,
    oneOf: subTransformer,
    anyOf: subTransformer,
  };
  const result: typeof subject = R.evolve(transformers, subject);
  return [result, hasRequired || Boolean(result.required?.length)];
};

export const depictResponse = ({
  method,
  path,
  schema,
  mimeTypes,
  variant,
  makeRef,
  composition,
  hasMultipleStatusCodes,
  statusCode,
  brandHandling,
  seenIds,
  description = `${method.toUpperCase()} ${path} ${ucFirst(variant)} response ${
    hasMultipleStatusCodes ? statusCode : ""
  }`.trim(),
}: ReqResCommons & {
  schema: z.ZodType;
  composition: "inline" | "components";
  description?: string;
  brandHandling?: BrandHandling;
  mimeTypes: NormalizedResponse["mimeTypes"];
  variant: ResponseVariant;
  statusCode: number;
  hasMultipleStatusCodes: boolean;
}): ResponseObject => {
  if (!shouldHaveContent(method, mimeTypes)) return { description };
  const response = asOAS(
    depict(schema, {
      rules: { ...brandHandling, ...depicters },
      ctx: { isResponse: true, makeRef, path, method, seenIds },
    }),
  );
  const examples: unknown[] = [];
  if (isSchemaObject(response) && response.examples) {
    examples.push(...response.examples);
    delete response.examples; // moving them up
  }
  const schemaOrRef =
    composition === "components"
      ? makeRef(schema, response, makeCleanId(description))
      : response;
  return {
    description,
    content: R.fromPairs(
      mimeTypes.map<[string, MediaTypeObject]>((mt) => {
        const key: keyof MediaTypeObject =
          mt === contentTypes.sse ? "itemSchema" : "schema";
        return [
          mt,
          { [key]: schemaOrRef, examples: enumerateExamples(examples) },
        ];
      }),
    ),
  };
};

const depictBearerSecurity = ({
  format: bearerFormat,
}: Extract<Security, { type: "bearer" }>) => {
  const result: SecuritySchemeObject = {
    type: "http",
    scheme: "bearer",
  };
  if (bearerFormat) result.bearerFormat = bearerFormat;
  return result;
};
const depictInputSecurity = (
  { name }: Extract<Security, { type: "input" }>,
  inputSources: InputSource[],
) => {
  const result: SecuritySchemeObject = {
    type: "apiKey",
    in: "query",
    name,
  };
  if (inputSources?.includes("body")) {
    if (inputSources?.includes("query")) {
      result["x-in-alternative"] = "body";
      result.description = `${name} CAN also be supplied within the request body`;
    } else {
      result["x-in-actual"] = "body";
      result.description = `${name} MUST be supplied within the request body instead of query`;
    }
  }
  return result;
};
const depictHeaderSecurity = ({
  name,
}: Extract<Security, { type: "header" }>) => ({
  type: "apiKey" as const,
  in: "header",
  name,
});
const depictCookieSecurity = ({
  name,
}: Extract<Security, { type: "cookie" }>) => ({
  type: "apiKey" as const,
  in: "cookie",
  name,
});
const depictOpenIdSecurity = ({
  url: openIdConnectUrl,
}: Extract<Security, { type: "openid" }>) => ({
  type: "openIdConnect" as const,
  openIdConnectUrl,
});
const depictOAuth2Security = ({
  flows = {},
  oauth2MetadataUrl,
}: Extract<Security, { type: "oauth2" }>) => ({
  type: "oauth2" as const,
  flows: R.map(
    (flow): OAuthFlowObject => ({ ...flow, scopes: flow.scopes || {} }),
    R.reject(R.isNil, flows) as Required<typeof flows>,
  ),
  oauth2MetadataUrl,
});

export const depictSecurity = (
  alternatives: Alternatives<Security>,
  inputSources: InputSource[] = [],
): Alternatives<SecuritySchemeObject> => {
  const mapper = (subj: Security): SecuritySchemeObject => {
    if (subj.type === "basic") return { type: "http", scheme: "basic" };
    else if (subj.type === "bearer") return depictBearerSecurity(subj);
    else if (subj.type === "input")
      return depictInputSecurity(subj, inputSources);
    else if (subj.type === "header") return depictHeaderSecurity(subj);
    else if (subj.type === "cookie") return depictCookieSecurity(subj);
    else if (subj.type === "openid") return depictOpenIdSecurity(subj);
    else return depictOAuth2Security(subj);
  };
  return alternatives.map((entries) =>
    entries.map(({ deprecated, ...rest }) => ({
      ...mapper(rest),
      deprecated,
    })),
  );
};

const hasScopes = Set.prototype.has.bind(
  new Set<SecuritySchemeType>(["oauth2", "openIdConnect"]),
);
export const depictSecurityRefs = (
  alternatives: Alternatives<SecuritySchemeObject>,
  scopes: ReadonlySet<string>,
  entitle: (subject: SecuritySchemeObject) => string,
): SecurityRequirementObject[] => {
  const list = Array.from(scopes);
  return alternatives.map((alternative) => {
    const refs: SecurityRequirementObject = {};
    for (const securitySchema of alternative) {
      const name = entitle(securitySchema);
      refs[name] = hasScopes(securitySchema.type) ? list : [];
    }
    return refs;
  });
};

export const depictRequest = ({
  schema,
  brandHandling,
  makeRef,
  path,
  method,
  seenIds,
}: ReqResCommons & {
  schema: IOSchema;
  brandHandling?: BrandHandling;
}) =>
  depict(schema, {
    rules: { ...brandHandling, ...depicters },
    ctx: { isResponse: false, makeRef, path, method, seenIds },
  });

export const depictBody = ({
  method,
  path,
  bodyJsonSchema,
  hasRequiredBodyProps,
  flatRequest,
  mimeType,
  makeRef,
  composition,
  paramNames,
  description = `${method.toUpperCase()} ${path} Request body`,
}: ReqResCommons & {
  composition: "inline" | "components";
  description?: string;
  bodyJsonSchema: z.core.JSONSchema.BaseSchema;
  hasRequiredBodyProps: boolean;
  flatRequest: FlattenObjectSchema;
  mimeType: string;
  paramNames: string[];
}) => {
  const pure = asOAS(bodyJsonSchema);
  const examples = [];
  if (isSchemaObject(pure) && pure.examples) {
    examples.push(...pure.examples);
    delete pure.examples; // pull up
  }
  const media: MediaTypeObject = {
    schema:
      composition === "components"
        ? makeRef(JSON.stringify(pure), pure, makeCleanId(description))
        : pure,
    examples: enumerateExamples(
      examples.length
        ? examples
        : flatRequest.examples
            ?.filter(
              (one): one is FlatObject => isObject(one) && !Array.isArray(one),
            )
            .map(R.omit(paramNames)) || [],
    ),
  };
  const body: RequestBodyObject = {
    description,
    content: { [mimeType]: media },
  };
  if (hasRequiredBodyProps || mimeType === contentTypes.raw)
    body.required = true;
  return body;
};

interface TagDetails extends Pick<
  TagObject,
  "summary" | "description" | "externalDocs" | "kind"
> {
  /** @desc shorthand for externalDocs.url */
  url?: string;
  parent?: Tag;
}

export const depictTags = (tags: Partial<Record<Tag, string | TagDetails>>) =>
  Object.entries(tags).reduce<TagObject[]>((agg, [name, def]) => {
    if (!def) return agg;
    if (typeof def === "string") return agg.concat({ name, description: def });
    const { url, ...tagObject } = def;
    const entry: TagObject = { ...tagObject, name };
    if (url) entry.externalDocs = { ...entry.externalDocs, url };
    return agg.concat(entry);
  }, []);

/** @desc Ensures the summary string does not exceed the limit */
export const trimSummary = (summary?: string, limit = 50) =>
  !summary || summary.length <= limit
    ? summary
    : summary.slice(0, Math.max(1, limit || 0) - 1) + "…";

export const nonEmpty = <T>(subject: Iterable<T>) => {
  const copy = Array.from(subject);
  return copy.length ? copy : undefined;
};
