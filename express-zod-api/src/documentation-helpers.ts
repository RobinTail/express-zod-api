import type {
  $ZodPipe,
  $ZodTransform,
  $ZodTuple,
  $ZodType,
  JSONSchema,
} from "@zod/core";
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
import { globalRegistry, z } from "zod";
import { ResponseVariant } from "./api-response";
import {
  combinations,
  doesAccept,
  FlatObject,
  getExamples,
  getRoutePathParams,
  getTransformedType,
  isSchema,
  makeCleanId,
  routePathParamsRegex,
  Tag,
  ucFirst,
} from "./common-helpers";
import { InputSource } from "./config-type";
import { ezDateInBrand } from "./date-in-schema";
import { ezDateOutBrand } from "./date-out-schema";
import { hasRaw } from "./deep-checks";
import { DocumentationError } from "./errors";
import { ezFileBrand } from "./file-schema";
import { extractObjectSchema, IOSchema } from "./io-schema";
import { Alternatives } from "./logical-container";
import { metaSymbol } from "./metadata";
import { Method } from "./method";
import { ProprietaryBrand } from "./proprietary-schemas";
import { ezRawBrand } from "./raw-schema";
import { FirstPartyKind } from "./schema-walker";
import { Security } from "./security";
import { ezUploadBrand } from "./upload-schema";
import wellKnownHeaders from "./well-known-headers.json";

export interface OpenAPIContext {
  isResponse: boolean;
  makeRef: (
    key: object,
    subject: SchemaObject | ReferenceObject,
    name?: string,
  ) => ReferenceObject;
  path: string;
  method: Method;
}

export type Overrider = (
  zodCtx: { zodSchema: $ZodType; jsonSchema: JSONSchema.BaseSchema },
  oasCtx: OpenAPIContext,
) => void;

/** @desc Using defaultIsHeader when returns null or undefined */
export type IsHeader = (
  name: string,
  method: Method,
  path: string,
) => boolean | null | undefined;

export type BrandHandling = Record<string | symbol, Overrider>;

interface ReqResHandlingProps<S extends $ZodType>
  extends Omit<OpenAPIContext, "isResponse"> {
  schema: S;
  composition: "inline" | "components";
  description?: string;
  brandHandling?: BrandHandling;
}

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

export const onDefault: Overrider = ({ zodSchema, jsonSchema }) =>
  (jsonSchema.default =
    globalRegistry.get(zodSchema)?.[metaSymbol]?.defaultLabel ??
    jsonSchema.default);

export const onUpload: Overrider = ({ jsonSchema }, ctx) => {
  if (ctx.isResponse)
    throw new DocumentationError("Please use ez.upload() only for input.", ctx);
  Object.assign(jsonSchema, { type: "string", format: "binary" });
};

export const onFile: Overrider = ({ jsonSchema }) => {
  delete jsonSchema.anyOf; // undo default
  Object.assign(jsonSchema, {
    type: "string",
    format:
      jsonSchema.type === "string"
        ? jsonSchema.format === "base64"
          ? "byte"
          : "file"
        : "binary",
  });
};

export const onUnion: Overrider = ({ zodSchema, jsonSchema }) => {
  if (!zodSchema._zod.disc) return;
  const propertyName = Array.from(zodSchema._zod.disc.keys()).pop();
  jsonSchema.discriminator ??= { propertyName };
};

const propsMerger = (a: unknown, b: unknown) => {
  if (Array.isArray(a) && Array.isArray(b)) return R.concat(a, b);
  if (a === b) return b;
  throw new Error("Can not flatten properties");
};
const approaches = {
  type: R.always("object"),
  properties: ({ properties: left = {} }, { properties: right = {} }) =>
    R.mergeDeepWith(propsMerger, left, right),
  required: ({ required: left = [] }, { required: right = [] }) =>
    R.union(left, right),
  examples: ({ examples: left = [] }, { examples: right = [] }) =>
    combinations(
      left.filter((entry) => typeof entry === "object"),
      right.filter((entry) => typeof entry === "object"),
      ([a, b]) => R.mergeDeepRight({ ...a }, { ...b }),
    ),
  description: ({ description: left }, { description: right }) => left || right,
} satisfies {
  [K in keyof JSONSchema.ObjectSchema]: (
    ...subj: JSONSchema.ObjectSchema[]
  ) => JSONSchema.ObjectSchema[K];
};
const canMerge = R.pipe(
  Object.keys,
  R.without(Object.keys(approaches)),
  R.isEmpty,
);

const intersect = (
  children: Array<JSONSchema.BaseSchema>,
): JSONSchema.ObjectSchema => {
  const [left, right] = children
    .map(({ _ref, ...rest }) => (_ref ? { ...rest, ..._ref } : rest))
    .filter(
      (schema): schema is JSONSchema.ObjectSchema => schema.type === "object",
    )
    .filter(canMerge);
  if (!left || !right) throw new Error("Can not flatten objects");
  const suitable: typeof approaches = R.pickBy(
    (_, prop) => (left[prop] || right[prop]) !== undefined,
    approaches,
  );
  return R.map((fn) => fn(left, right), suitable);
};

export const onIntersection: Overrider = ({ jsonSchema }) => {
  if (!jsonSchema.allOf) return;
  try {
    const attempt = intersect(jsonSchema.allOf);
    delete jsonSchema.allOf; // undo default
    Object.assign(jsonSchema, attempt);
  } catch {}
};

/** @since OAS 3.1 nullable replaced with type array having null */
export const onNullable: Overrider = ({ jsonSchema }) => {
  if (!jsonSchema.anyOf) return;
  const original = jsonSchema.anyOf[0];
  Object.assign(original, { type: makeNullableType(original) });
  Object.assign(jsonSchema, original);
  delete jsonSchema.anyOf;
};

const isSupportedType = (subject: string): subject is SchemaObjectType =>
  subject in samples;

export const onDateIn: Overrider = ({ jsonSchema }, ctx) => {
  if (ctx.isResponse)
    throw new DocumentationError("Please use ez.dateOut() for output.", ctx);
  delete jsonSchema._ref; // undo default
  Object.assign(jsonSchema, {
    description: "YYYY-MM-DDTHH:mm:ss.sssZ",
    type: "string",
    format: "date-time",
    pattern: /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?)?Z?$/.source,
    externalDocs: {
      url: isoDateDocumentationUrl,
    },
  });
};

export const onDateOut: Overrider = ({ jsonSchema }, ctx) => {
  if (!ctx.isResponse)
    throw new DocumentationError("Please use ez.dateIn() for input.", ctx);
  Object.assign(jsonSchema, {
    description: "YYYY-MM-DDTHH:mm:ss.sssZ",
    type: "string",
    format: "date-time",
    externalDocs: {
      url: isoDateDocumentationUrl,
    },
  });
};

export const onBigInt: Overrider = ({ jsonSchema }) =>
  Object.assign(jsonSchema, {
    type: "string",
    format: "bigint",
    pattern: /^-?\d+$/.source,
  });

/**
 * @since OAS 3.1 using prefixItems for depicting tuples
 * @since 17.5.0 added rest handling, fixed tuple type
 */
export const onTuple: Overrider = ({ zodSchema, jsonSchema }) => {
  if ((zodSchema as $ZodTuple)._zod.def.rest !== null) return;
  // does not appear to support items:false, so not:{} is a recommended alias
  jsonSchema.items = { not: {} };
};

const makeSample = (depicted: SchemaObject) => {
  const firstType = (
    Array.isArray(depicted.type) ? depicted.type[0] : depicted.type
  ) as keyof typeof samples;
  return samples?.[firstType];
};

const makeNullableType = ({
  type,
}: JSONSchema.BaseSchema | SchemaObject):
  | SchemaObjectType
  | SchemaObjectType[] => {
  if (type === "null") return type;
  if (typeof type === "string")
    return isSupportedType(type) ? [type, "null"] : "null";
  return type ? [...new Set(type).add("null")] : "null";
};

export const onPipeline: Overrider = ({ zodSchema, jsonSchema }, ctx) => {
  const target = (zodSchema as $ZodPipe)._zod.def[
    ctx.isResponse ? "out" : "in"
  ];
  const opposite = (zodSchema as $ZodPipe)._zod.def[
    ctx.isResponse ? "in" : "out"
  ];
  if (isSchema<$ZodTransform>(target, "transform")) {
    const opposingDepiction = depict(opposite, { ctx });
    if (isSchemaObject(opposingDepiction)) {
      if (!ctx.isResponse) {
        const { type: opposingType, ...rest } = opposingDepiction;
        Object.assign(jsonSchema, {
          ...rest,
          format: `${rest.format || opposingType} (preprocessed)`,
        });
      } else {
        const targetType = getTransformedType(
          target,
          makeSample(opposingDepiction),
        );
        if (
          targetType &&
          ["number", "string", "boolean"].includes(targetType)
        ) {
          Object.assign(jsonSchema, {
            type: targetType as "number" | "string" | "boolean",
          });
        }
      }
    }
  }
};

export const onRaw: Overrider = ({ jsonSchema }) => {
  if (!jsonSchema._ref) return;
  if (jsonSchema._ref.type !== "object") return;
  const objSchema = jsonSchema._ref as JSONSchema.ObjectSchema;
  if (!objSchema.properties) return;
  if (!("raw" in objSchema.properties)) return;
  delete jsonSchema._ref; // undo
  Object.assign(jsonSchema, objSchema.properties.raw);
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

export const depictExamples = (
  schema: $ZodType,
  isResponse: boolean,
  omitProps: string[] = [],
): ExamplesObject | undefined => {
  const isObject = (subj: unknown): subj is FlatObject =>
    R.type(subj) === "Object";
  return R.pipe(
    getExamples,
    R.map(R.when(isObject, R.omit(omitProps))),
    enumerateExamples,
  )({
    schema,
    variant: isResponse ? "parsed" : "original",
    validate: true,
    pullProps: true,
  });
};

export const depictParamExamples = (
  schema: z.ZodType,
  param: string,
): ExamplesObject | undefined => {
  const isObject = (subj: unknown): subj is FlatObject =>
    R.type(subj) === "Object";
  return R.pipe(
    getExamples,
    R.filter(R.both(isObject, R.has(param))),
    R.pluck(param),
    enumerateExamples,
  )({ schema, variant: "original", validate: true, pullProps: true });
};

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
  schema,
  inputSources,
  makeRef,
  composition,
  brandHandling,
  isHeader,
  security,
  description = `${method.toUpperCase()} ${path} Parameter`,
}: ReqResHandlingProps<IOSchema> & {
  inputSources: InputSource[];
  isHeader?: IsHeader;
  security?: Alternatives<Security>;
}) => {
  const objectSchema = extractObjectSchema(schema);
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

  return Object.entries(objectSchema.shape).reduce<ParameterObject[]>(
    (acc, [name, paramSchema]) => {
      const location = isPathParam(name)
        ? "path"
        : isHeaderParam(name)
          ? "header"
          : isQueryEnabled
            ? "query"
            : undefined;
      if (!location) return acc;
      const depicted = depict(paramSchema, {
        rules: { ...brandHandling, ...overrides },
        ctx: { isResponse: false, makeRef, path, method },
      });
      const result =
        composition === "components"
          ? makeRef(paramSchema, depicted, makeCleanId(description, name))
          : depicted;
      return acc.concat({
        name,
        in: location,
        deprecated: globalRegistry.get(paramSchema)?.deprecated,
        required: !doesAccept(paramSchema, undefined),
        description: depicted.description || description,
        schema: result,
        examples: depictParamExamples(objectSchema, name),
      });
    },
    [],
  );
};

const overrides: Partial<Record<FirstPartyKind | ProprietaryBrand, Overrider>> =
  {
    nullable: onNullable,
    default: onDefault,
    union: onUnion,
    bigint: onBigInt,
    intersection: onIntersection,
    tuple: onTuple,
    pipe: onPipeline,
    [ezDateInBrand]: onDateIn,
    [ezDateOutBrand]: onDateOut,
    [ezUploadBrand]: onUpload,
    [ezFileBrand]: onFile,
    [ezRawBrand]: onRaw,
  };

const onEach: Overrider = ({ zodSchema, jsonSchema }, { isResponse }) => {
  const shouldAvoidParsing =
    zodSchema._zod.def.type === "lazy" || zodSchema._zod.def.type === "promise";
  const hasTypePropertyInDepiction = jsonSchema.type !== undefined;
  const acceptsNull =
    !isResponse &&
    !shouldAvoidParsing &&
    hasTypePropertyInDepiction &&
    zodSchema instanceof z.ZodType &&
    zodSchema.isNullable();
  if (acceptsNull)
    Object.assign(jsonSchema, { type: makeNullableType(jsonSchema) });
  const examples = getExamples({
    schema: zodSchema,
    variant: isResponse ? "parsed" : "original",
    validate: true,
  });
  if (examples.length) jsonSchema.examples = examples.slice();
};

/**
 * postprocessing refs: specifying "uri" function and custom registries didn't allow to customize ref name
 * @todo is there a less hacky way to do that?
 * */
const fixReferences = (
  subject: JSONSchema.BaseSchema,
  defs: Record<string, JSONSchema.BaseSchema>,
  ctx: OpenAPIContext,
) => {
  const stack: unknown[] = [subject, defs];
  while (stack.length) {
    const entry = stack.shift()!;
    if (R.is(Object, entry)) {
      if (isReferenceObject(entry) && !entry.$ref.startsWith("#/components")) {
        const actualName = entry.$ref.split("/").pop()!;
        const depiction = defs[actualName];
        if (depiction)
          entry.$ref = ctx.makeRef(depiction, depiction as SchemaObject).$ref; // @todo see below
        continue;
      }
      stack.push(...R.values(entry));
    }
    if (R.is(Array, entry)) stack.push(...R.values(entry));
  }
  return subject as SchemaObject; // @todo ideally, there should be a method to ensure that
};

const depict = (
  subject: $ZodType,
  { ctx, rules = overrides }: { ctx: OpenAPIContext; rules?: BrandHandling },
) => {
  const { $defs = {}, properties = {} } = z.toJSONSchema(
    z.object({ subject }), // avoiding "document root" references
    {
      unrepresentable: "any",
      io: ctx.isResponse ? "output" : "input",
      override: (zodCtx) => {
        const { brand } =
          globalRegistry.get(zodCtx.zodSchema)?.[metaSymbol] ?? {};
        rules[
          brand && brand in rules ? brand : zodCtx.zodSchema._zod.def.type
        ]?.(zodCtx, ctx);
        onEach(zodCtx, ctx);
      },
    },
  ) as JSONSchema.ObjectSchema;
  return fixReferences(properties["subject"], $defs, ctx);
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

export const excludeExamplesFromDepiction = (
  depicted: SchemaObject | ReferenceObject,
): SchemaObject | ReferenceObject =>
  isReferenceObject(depicted) ? depicted : R.omit(["examples"], depicted);

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
}: ReqResHandlingProps<$ZodType> & {
  mimeTypes: ReadonlyArray<string> | null;
  variant: ResponseVariant;
  statusCode: number;
  hasMultipleStatusCodes: boolean;
}): ResponseObject => {
  if (!mimeTypes) return { description };
  const depictedSchema = excludeExamplesFromDepiction(
    depict(schema, {
      rules: { ...brandHandling, ...overrides },
      ctx: { isResponse: true, makeRef, path, method },
    }),
  );
  const media: MediaTypeObject = {
    schema:
      composition === "components"
        ? makeRef(schema, depictedSchema, makeCleanId(description))
        : depictedSchema,
    examples: depictExamples(schema, true),
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

export const depictBody = ({
  method,
  path,
  schema,
  mimeType,
  makeRef,
  composition,
  brandHandling,
  paramNames,
  description = `${method.toUpperCase()} ${path} Request body`,
}: ReqResHandlingProps<IOSchema> & {
  mimeType: string;
  paramNames: string[];
}) => {
  const [withoutParams, hasRequired] = excludeParamsFromDepiction(
    depict(schema, {
      rules: { ...brandHandling, ...overrides },
      ctx: { isResponse: false, makeRef, path, method },
    }),
    paramNames,
  );
  const bodyDepiction = excludeExamplesFromDepiction(withoutParams);
  const media: MediaTypeObject = {
    schema:
      composition === "components"
        ? makeRef(schema, bodyDepiction, makeCleanId(description))
        : bodyDepiction,
    examples: depictExamples(extractObjectSchema(schema), false, paramNames),
  };
  const body: RequestBodyObject = {
    description,
    content: { [mimeType]: media },
  };
  if (hasRequired || hasRaw(schema)) body.required = true;
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
