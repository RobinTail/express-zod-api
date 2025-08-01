import {
  ExamplesObject,
  isReferenceObject,
  isSchemaObject,
  MediaTypeObject,
  OAuthFlowObject,
  ParameterObject,
  ReferenceObject,
  RequestBodyObject,
  ResponseObject,
  SchemaObject,
  SchemaObjectType,
  SecurityRequirementObject,
  SecuritySchemeObject,
  TagObject,
} from "openapi3-ts/oas31";
import * as R from "ramda";
import { z } from "zod";
import { NormalizedResponse, ResponseVariant } from "./api-response";
import { ezBufferBrand } from "./buffer-schema";
import {
  shouldHaveContent,
  FlatObject,
  getRoutePathParams,
  getTransformedType,
  isObject,
  isSchema,
  makeCleanId,
  routePathParamsRegex,
  Tag,
  ucFirst,
} from "./common-helpers";
import { InputSource } from "./config-type";
import { contentTypes } from "./content-type";
import { ezDateInBrand } from "./date-in-schema";
import { ezDateOutBrand } from "./date-out-schema";
import { DocumentationError } from "./errors";
import { IOSchema } from "./io-schema";
import { flattenIO } from "./json-schema-helpers";
import { Alternatives } from "./logical-container";
import { getBrand } from "./metadata";
import { ClientMethod } from "./method";
import { ProprietaryBrand } from "./proprietary-schemas";
import { ezRawBrand } from "./raw-schema";
import { FirstPartyKind } from "./schema-walker";
import { Security } from "./security";
import { ezUploadBrand } from "./upload-schema";
import wellKnownHeaders from "./well-known-headers.json";

interface ReqResCommons {
  makeRef: (
    key: object | string,
    subject: SchemaObject | ReferenceObject,
    name?: string,
  ) => ReferenceObject;
  path: string;
  method: ClientMethod;
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
) => z.core.JSONSchema.BaseSchema | SchemaObject;

/** @desc Using defaultIsHeader when returns null or undefined */
export type IsHeader = (
  name: string,
  method: ClientMethod,
  path: string,
) => boolean | null | undefined;

export type BrandHandling = Record<string | symbol, Depicter>;

const shortDescriptionLimit = 50;
const isoDateDocumentationUrl =
  "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toISOString";

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
  if (!jsonSchema.anyOf) return jsonSchema;
  const original = jsonSchema.anyOf[0];
  return Object.assign(original, { type: makeNullableType(original.type) });
};

/** @since v24.3.1 schema compliance is fully delegated to Zod */
const asOAS = (subject: z.core.JSONSchema.BaseSchema) =>
  subject as SchemaObject | ReferenceObject;

export const depictDateIn: Depicter = (
  { jsonSchema: { examples, description } },
  ctx,
) => {
  if (ctx.isResponse)
    throw new DocumentationError("Please use ez.dateOut() for output.", ctx);
  const jsonSchema: z.core.JSONSchema.StringSchema = {
    description: description || "YYYY-MM-DDTHH:mm:ss.sssZ",
    type: "string",
    format: "date-time",
    pattern: /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?)?Z?$/.source,
    externalDocs: { url: isoDateDocumentationUrl },
  };
  if (examples?.length) jsonSchema.examples = examples;
  return jsonSchema;
};

export const depictDateOut: Depicter = (
  { jsonSchema: { examples, description } },
  ctx,
) => {
  if (!ctx.isResponse)
    throw new DocumentationError("Please use ez.dateIn() for input.", ctx);
  const jsonSchema: z.core.JSONSchema.StringSchema = {
    description: description || "YYYY-MM-DDTHH:mm:ss.sssZ",
    type: "string",
    format: "date-time",
    externalDocs: { url: isoDateDocumentationUrl },
  };
  if (examples?.length) jsonSchema.examples = examples;
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

const makeSample = (depicted: SchemaObject) => {
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
      if (targetType && ["number", "string", "boolean"].includes(targetType)) {
        return {
          ...jsonSchema,
          type: targetType as "number" | "string" | "boolean",
        };
      }
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
          R.map(R.objOf("value"), examples),
        ),
      )
    : undefined;

export const defaultIsHeader = (
  name: string,
  familiar?: string[],
): name is `x-${string}` =>
  familiar?.includes(name) ||
  name.startsWith("x-") ||
  wellKnownHeaders.includes(name);

export const depictRequestParams = ({
  path,
  method,
  request,
  inputSources,
  makeRef,
  composition,
  isHeader,
  security,
  description = `${method.toUpperCase()} ${path} Parameter`,
}: ReqResCommons & {
  composition: "inline" | "components";
  description?: string;
  request: z.core.JSONSchema.BaseSchema;
  inputSources: InputSource[];
  isHeader?: IsHeader;
  security?: Alternatives<Security>;
}) => {
  const flat = flattenIO(request);
  const pathParams = getRoutePathParams(path);
  const isQueryEnabled = inputSources.includes("query");
  const areParamsEnabled = inputSources.includes("params");
  const areHeadersEnabled = inputSources.includes("headers");
  const isPathParam = (name: string) =>
    areParamsEnabled && pathParams.includes(name);
  const securityHeaders = R.chain(
    R.filter((entry: Security) => entry.type === "header"),
    security ?? [],
  ).map(({ name }) => name);
  const isHeaderParam = (name: string) =>
    areHeadersEnabled &&
    (isHeader?.(name, method, path) ?? defaultIsHeader(name, securityHeaders));

  return Object.entries(flat.properties).reduce<ParameterObject[]>(
    (acc, [name, jsonSchema]) => {
      if (!isObject(jsonSchema)) return acc;
      const location = isPathParam(name)
        ? "path"
        : isHeaderParam(name)
          ? "header"
          : isQueryEnabled
            ? "query"
            : undefined;
      if (!location) return acc;
      const depicted = asOAS(jsonSchema);
      const result =
        composition === "components"
          ? makeRef(
              jsonSchema.id || JSON.stringify(jsonSchema),
              depicted,
              makeCleanId(description, name),
            )
          : depicted;
      return acc.concat({
        name,
        in: location,
        deprecated: jsonSchema.deprecated,
        required: flat.required?.includes(name) || false,
        description: depicted.description || description,
        schema: result,
        examples: enumerateExamples(
          isSchemaObject(depicted) && depicted.examples?.length
            ? depicted.examples // own examples or from the flat:
            : R.pluck(
                name,
                flat.examples?.filter(R.both(isObject, R.has(name))) || [],
              ),
        ),
      });
    },
    [],
  );
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
 * @todo simplify if fixed (unable to customize references):
 * @link https://github.com/colinhacks/zod/issues/4281
 * */
const fixReferences = (
  subject: z.core.JSONSchema.BaseSchema,
  defs: Record<string, z.core.JSONSchema.BaseSchema>,
  ctx: OpenAPIContext,
) => {
  const stack: unknown[] = [subject, defs];
  while (stack.length) {
    const entry = stack.shift()!;
    if (R.is(Object, entry)) {
      if (isReferenceObject(entry) && !entry.$ref.startsWith("#/components")) {
        const actualName = entry.$ref.split("/").pop()!;
        const depiction = defs[actualName];
        if (depiction) {
          entry.$ref = ctx.makeRef(
            depiction.id || depiction, // avoiding serialization, because changing $ref
            asOAS(depiction),
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
  subject: SchemaObject | ReferenceObject,
  names: string[],
): [SchemaObject | ReferenceObject, boolean] => {
  if (isReferenceObject(subject)) return [subject, false];
  let hasRequired = false;
  const subTransformer = R.map((entry: SchemaObject | ReferenceObject) => {
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
  const result: SchemaObject = R.evolve(transformers, subject);
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
  description = `${method.toUpperCase()} ${path} ${ucFirst(variant)} response ${
    hasMultipleStatusCodes ? statusCode : ""
  }`.trim(),
}: ReqResCommons & {
  schema: z.core.$ZodType;
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
      ctx: { isResponse: true, makeRef, path, method },
    }),
  );
  const examples = [];
  if (isSchemaObject(response) && response.examples) {
    examples.push(...response.examples);
    delete response.examples; // moving them up
  }
  const media: MediaTypeObject = {
    schema:
      composition === "components"
        ? makeRef(schema, response, makeCleanId(description))
        : response,
    examples: enumerateExamples(examples),
  };
  return { description, content: R.fromPairs(R.xprod(mimeTypes, [media])) };
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
}: Extract<Security, { type: "oauth2" }>) => ({
  type: "oauth2" as const,
  flows: R.map(
    (flow): OAuthFlowObject => ({ ...flow, scopes: flow.scopes || {} }),
    R.reject(R.isNil, flows) as Required<typeof flows>,
  ),
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
  return alternatives.map((entries) => entries.map(mapper));
};

export const depictSecurityRefs = (
  alternatives: Alternatives<SecuritySchemeObject>,
  scopes: string[] | ReadonlyArray<string>,
  entitle: (subject: SecuritySchemeObject) => string,
): SecurityRequirementObject[] =>
  alternatives.map((alternative) =>
    alternative.reduce<SecurityRequirementObject>((refs, securitySchema) => {
      const name = entitle(securitySchema);
      const hasScopes = ["oauth2", "openIdConnect"].includes(
        securitySchema.type,
      );
      return Object.assign(refs, { [name]: hasScopes ? scopes : [] });
    }, {}),
  );

export const depictRequest = ({
  schema,
  brandHandling,
  makeRef,
  path,
  method,
}: ReqResCommons & {
  schema: IOSchema;
  brandHandling?: BrandHandling;
}) =>
  depict(schema, {
    rules: { ...brandHandling, ...depicters },
    ctx: { isResponse: false, makeRef, path, method },
  });

export const depictBody = ({
  method,
  path,
  schema,
  request,
  mimeType,
  makeRef,
  composition,
  paramNames,
  description = `${method.toUpperCase()} ${path} Request body`,
}: ReqResCommons & {
  schema: IOSchema;
  composition: "inline" | "components";
  description?: string;
  request: z.core.JSONSchema.BaseSchema;
  mimeType: string;
  paramNames: string[];
}) => {
  const [withoutParams, hasRequired] = excludeParamsFromDepiction(
    asOAS(request),
    paramNames,
  );
  const examples = [];
  if (isSchemaObject(withoutParams) && withoutParams.examples) {
    examples.push(...withoutParams.examples);
    delete withoutParams.examples; // pull up
  }
  const media: MediaTypeObject = {
    schema:
      composition === "components"
        ? makeRef(schema, withoutParams, makeCleanId(description))
        : withoutParams,
    examples: enumerateExamples(
      examples.length
        ? examples
        : flattenIO(request)
            .examples?.filter(
              (one): one is FlatObject => isObject(one) && !Array.isArray(one),
            )
            .map(R.omit(paramNames)) || [],
    ),
  };
  const body: RequestBodyObject = {
    description,
    content: { [mimeType]: media },
  };
  if (hasRequired || mimeType === contentTypes.raw) body.required = true;
  return body;
};

export const depictTags = (
  tags: Partial<Record<Tag, string | { description: string; url?: string }>>,
) =>
  Object.entries(tags).reduce<TagObject[]>((agg, [tag, def]) => {
    if (!def) return agg;
    const entry: TagObject = {
      name: tag,
      description: typeof def === "string" ? def : def.description,
    };
    if (typeof def === "object" && def.url)
      entry.externalDocs = { url: def.url };
    return agg.concat(entry);
  }, []);

export const ensureShortDescription = (description: string) =>
  description.length <= shortDescriptionLimit
    ? description
    : description.slice(0, shortDescriptionLimit - 1) + "…";

export const nonEmpty = <T>(subject: T[] | ReadonlyArray<T>) =>
  subject.length ? subject.slice() : undefined;
