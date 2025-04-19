import type {
  $ZodEnum,
  $ZodLiteral,
  $ZodPipe,
  $ZodTuple,
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
  FlatObject,
  getExamples,
  getRoutePathParams,
  getTransformedType,
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
import {
  FirstPartyKind,
  HandlingRules,
  SchemaHandler,
  walkSchema,
} from "./schema-walker";
import { Security } from "./security";
import { ezUploadBrand } from "./upload-schema";
import wellKnownHeaders from "./well-known-headers.json";

export interface OpenAPIContext extends FlatObject {
  isResponse: boolean;
  makeRef: (
    subject: SchemaObject | ReferenceObject,
    name?: string,
  ) => ReferenceObject;
  brandHandling: HandlingRules<SchemaObject | ReferenceObject, OpenAPIContext>;
  path: string;
  method: Method;
}

export type Depicter = SchemaHandler<
  SchemaObject | ReferenceObject,
  OpenAPIContext
>;

/** @desc Using defaultIsHeader when returns null or undefined */
export type IsHeader = (
  name: string,
  method: Method,
  path: string,
) => boolean | null | undefined;

interface ReqResHandlingProps<S extends z.ZodTypeAny>
  extends Pick<
    OpenAPIContext,
    "makeRef" | "brandHandling" | "path" | "method"
  > {
  schema: S;
  composition: "inline" | "components";
  description?: string;
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
} satisfies Record<Extract<SchemaObjectType, string>, unknown>;

export const reformatParamsInPath = (path: string) =>
  path.replace(routePathParamsRegex, (param) => `{${param.slice(1)}}`);

export const delegate: Depicter = (schema, ctx) => {
  const result = z.toJSONSchema(schema, {
    unrepresentable: "any",
    metadata: globalRegistry,
    io: ctx.isResponse ? "output" : "input",
    override: ({ zodSchema, jsonSchema }) => {
      const brand = globalRegistry.get(zodSchema)?.[metaSymbol]?.brand;
      if (zodSchema._zod.def.type === "nullable" && jsonSchema.oneOf) {
        const original = jsonSchema.oneOf[0];
        Object.assign(original, {
          type: makeNullableType(original as SchemaObject), // @todo remove "as"
        });
        Object.assign(jsonSchema, original);
        delete jsonSchema.oneOf; // undo defaults
      }
      if (zodSchema._zod.def.type === "default") {
        jsonSchema.default =
          globalRegistry.get(zodSchema)?.[metaSymbol]?.defaultLabel ??
          jsonSchema.default;
      }
      if (zodSchema._zod.def.type === "any") jsonSchema.format = "any";
      if (zodSchema._zod.def.type === "union" && zodSchema._zod.disc) {
        const propertyName = Array.from(zodSchema._zod.disc.keys()).pop();
        jsonSchema.discriminator = { propertyName };
      }
      if (zodSchema._zod.def.type === "enum") {
        jsonSchema.type = getSupportedType(
          Object.values((zodSchema as $ZodEnum)._zod.def.entries)[0],
        );
      }
      if (zodSchema._zod.def.type === "bigint")
        Object.assign(jsonSchema, { type: "integer", format: "bigint" });
      if (zodSchema._zod.def.type === "intersection" && jsonSchema.allOf) {
        const attempt = intersect(jsonSchema.allOf as SchemaObject[]); // @todo remove "as"
        delete jsonSchema.allOf; // undo default
        Object.assign(jsonSchema, attempt);
      }
      if (zodSchema._zod.def.type === "literal") {
        jsonSchema.type = getSupportedType(
          Object.values((zodSchema as $ZodLiteral)._zod.def.values)[0],
        );
      }
      if (
        zodSchema._zod.def.type === "tuple" &&
        (zodSchema as $ZodTuple)._zod.def.rest === null
      ) {
        // does not appear to support items:false, so not:{} is a recommended alias
        jsonSchema.items = { not: {} };
      }
      if (zodSchema._zod.def.type === "pipe") {
        const target = (zodSchema as $ZodPipe)._zod.def[
          ctx.isResponse ? "out" : "in"
        ];
        const opposite = (zodSchema as $ZodPipe)._zod.def[
          ctx.isResponse ? "in" : "out"
        ];
        if (target instanceof z.ZodTransform) {
          const opposingDepiction = delegate(opposite, ctx);
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
              } else {
                Object.assign(jsonSchema, delegate(z.any(), ctx));
              }
            }
          }
        }
      }
      if (brand === ezDateInBrand) {
        if (ctx.isResponse) {
          throw new DocumentationError(
            "Please use ez.dateOut() for output.",
            ctx,
          );
        }
        delete jsonSchema.oneOf; // undo default
        Object.assign(jsonSchema, {
          description: "YYYY-MM-DDTHH:mm:ss.sssZ",
          type: "string",
          format: "date-time",
          pattern: /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?)?Z?$/.source,
          externalDocs: {
            url: isoDateDocumentationUrl,
          },
        });
      }
      if (brand === ezDateOutBrand) {
        if (!ctx.isResponse) {
          throw new DocumentationError(
            "Please use ez.dateIn() for input.",
            ctx,
          );
        }
        Object.assign(jsonSchema, {
          description: "YYYY-MM-DDTHH:mm:ss.sssZ",
          type: "string",
          format: "date-time",
          externalDocs: {
            url: isoDateDocumentationUrl,
          },
        });
      }
      if (brand === ezUploadBrand) {
        if (ctx.isResponse) {
          throw new DocumentationError(
            "Please use ez.upload() only for input.",
            ctx,
          );
        }
        Object.assign(jsonSchema, { type: "string", format: "binary" });
      }
      if (brand === ezFileBrand) {
        delete jsonSchema.oneOf; // undo default
        Object.assign(jsonSchema, {
          type: "string",
          format:
            jsonSchema.type === "string"
              ? jsonSchema.format === "base64"
                ? "byte"
                : "file"
              : "binary",
        });
      }
      if (brand === ezRawBrand) {
        Object.assign(
          jsonSchema,
          (jsonSchema as JSONSchema.ObjectSchema).properties!.raw,
        );
        delete jsonSchema.properties; // undo default
        delete jsonSchema.required;
      }
      // custom brands handling
      if (brand && ctx.brandHandling[brand]) {
        for (const key in jsonSchema) delete jsonSchema[key]; // undo default
        Object.assign(jsonSchema, ctx.brandHandling[brand](zodSchema, ctx));
      }
      // on each
      const shouldAvoidParsing =
        zodSchema._zod.def.type === "lazy" ||
        zodSchema._zod.def.type === "promise";
      const hasTypePropertyInDepiction = jsonSchema.type !== undefined;
      const acceptsNull =
        !ctx.isResponse &&
        !shouldAvoidParsing &&
        hasTypePropertyInDepiction &&
        (zodSchema as z.ZodType).isNullable(); // @todo remove "as"
      if (acceptsNull) {
        Object.assign(jsonSchema, {
          type: makeNullableType(jsonSchema as SchemaObject), // @todo remove "as"
        });
      }
      const examples = getExamples({
        schema: zodSchema as z.ZodType, // @todo remove "as"
        variant: ctx.isResponse ? "parsed" : "original",
        validate: true,
      });
      if (examples.length) jsonSchema.examples = examples.slice();
    },
  });
  const { $defs, ...rest } = result;

  /**
   * postprocessing refs: specifying "uri" function and custom registries didn't allow to customize ref name
   * @todo is there a less hacky way to do that?
   * */
  const stack: unknown[] = [rest, $defs];
  while (stack.length) {
    const entry = stack.shift()!;
    if (R.is(Object, entry)) {
      if (isReferenceObject(entry) && !entry.$ref.startsWith("#/components")) {
        const actualName = entry.$ref.split("/").pop()!;
        const depiction = $defs?.[actualName];
        if (depiction)
          entry.$ref = ctx.makeRef(depiction as SchemaObject, actualName).$ref; // @todo remove as
        continue;
      }
      stack.push(...R.values(entry));
    }
    if (R.is(Array, entry)) stack.push(...R.values(entry));
  }
  // ^^

  return rest as SchemaObject;
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
    combinations(left, right, ([a, b]) => R.mergeDeepRight(a, b)),
  description: ({ description: left }, { description: right }) => left || right,
} satisfies {
  [K in keyof SchemaObject]: (...subj: SchemaObject[]) => SchemaObject[K];
};
const canMerge = R.both(
  ({ type }: SchemaObject) => type === "object",
  R.pipe(Object.keys, R.without(Object.keys(approaches)), R.isEmpty),
);

const intersect = R.tryCatch(
  (children: Array<SchemaObject | ReferenceObject>): SchemaObject => {
    const [left, right] = children.filter(isSchemaObject).filter(canMerge);
    if (!left || !right) throw new Error("Can not flatten objects");
    const suitable: typeof approaches = R.pickBy(
      (_, prop) => (left[prop] || right[prop]) !== undefined,
      approaches,
    );
    return R.map((fn) => fn(left, right), suitable);
  },
  (_err, allOf): SchemaObject => ({ allOf }),
);

const getSupportedType = (value: unknown): SchemaObjectType | undefined => {
  const detected = R.toLower(R.type(value)); // toLower is typed well unlike .toLowerCase()
  const isSupported =
    detected === "number" ||
    detected === "string" ||
    detected === "boolean" ||
    detected === "object" ||
    detected === "null" ||
    detected === "array";
  return typeof value === "bigint"
    ? "integer"
    : isSupported
      ? detected
      : undefined;
};

const makeSample = (depicted: SchemaObject) => {
  const firstType = (
    Array.isArray(depicted.type) ? depicted.type[0] : depicted.type
  ) as keyof typeof samples;
  return samples?.[firstType];
};

const makeNullableType = ({
  type,
}: SchemaObject): SchemaObjectType | SchemaObjectType[] => {
  if (type === "null") return type;
  if (typeof type === "string") return [type, "null"];
  return type ? [...new Set(type).add("null")] : "null";
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
  schema: z.ZodType,
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
      const depicted = walkSchema(paramSchema, {
        rules: depicters,
        onEach,
        onMissing,
        ctx: { isResponse: false, makeRef, path, method, brandHandling },
      });
      const result =
        composition === "components"
          ? makeRef(depicted, makeCleanId(description, name))
          : depicted;
      return acc.concat({
        name,
        in: location,
        deprecated: globalRegistry.get(paramSchema)?.deprecated,
        required: !(paramSchema as z.ZodType).isOptional(),
        description: depicted.description || description,
        schema: result,
        examples: depictParamExamples(objectSchema, name),
      });
    },
    [],
  );
};

export const depicters: HandlingRules<
  SchemaObject | ReferenceObject,
  OpenAPIContext,
  FirstPartyKind | ProprietaryBrand
> = {
  string: delegate,
  number: delegate,
  bigint: delegate,
  boolean: delegate,
  null: delegate,
  array: delegate,
  tuple: delegate,
  record: delegate,
  object: delegate,
  literal: delegate,
  intersection: delegate,
  union: delegate,
  any: delegate,
  default: delegate,
  enum: delegate,
  optional: delegate,
  nullable: delegate,
  date: delegate,
  catch: delegate,
  pipe: delegate,
  lazy: delegate,
  readonly: delegate,
  [ezFileBrand]: delegate,
  [ezUploadBrand]: delegate,
  [ezDateOutBrand]: delegate,
  [ezDateInBrand]: delegate,
  [ezRawBrand]: delegate,
};

export const onEach: SchemaHandler<
  SchemaObject | ReferenceObject,
  OpenAPIContext,
  "each"
> = (schema: z.ZodType, { isResponse, prev }) => {
  if (isReferenceObject(prev)) return {};
  const { description } = schema;
  const shouldAvoidParsing =
    schema instanceof z.ZodLazy || schema instanceof z.ZodPromise;
  const hasTypePropertyInDepiction = prev.type !== undefined;
  const acceptsNull =
    !isResponse &&
    !shouldAvoidParsing &&
    hasTypePropertyInDepiction &&
    schema.isNullable();
  const result: SchemaObject = {};
  if (description) result.description = description;
  if (schema.meta()?.deprecated) result.deprecated = true;
  if (acceptsNull) result.type = makeNullableType(prev);
  if (!shouldAvoidParsing) {
    const examples = getExamples({
      schema,
      variant: isResponse ? "parsed" : "original",
      validate: true,
    });
    if (examples.length) result.examples = examples.slice();
  }
  return result;
};

export const onMissing: SchemaHandler<
  SchemaObject | ReferenceObject,
  OpenAPIContext,
  "last"
> = (schema: z.ZodTypeAny, ctx) => {
  throw new DocumentationError(
    `Zod type ${schema.constructor.name} is unsupported.`,
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
}: ReqResHandlingProps<z.ZodTypeAny> & {
  mimeTypes: ReadonlyArray<string> | null;
  variant: ResponseVariant;
  statusCode: number;
  hasMultipleStatusCodes: boolean;
}): ResponseObject => {
  if (!mimeTypes) return { description };
  const depictedSchema = excludeExamplesFromDepiction(
    walkSchema(schema, {
      rules: depicters,
      onEach,
      onMissing,
      ctx: { isResponse: true, makeRef, path, method, brandHandling },
    }),
  );
  const media: MediaTypeObject = {
    schema:
      composition === "components"
        ? makeRef(depictedSchema, makeCleanId(description))
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
    walkSchema(schema, {
      rules: depicters,
      onEach,
      onMissing,
      ctx: { isResponse: false, makeRef, path, method, brandHandling },
    }),
    paramNames,
  );
  const bodyDepiction = excludeExamplesFromDepiction(withoutParams);
  const media: MediaTypeObject = {
    schema:
      composition === "components"
        ? makeRef(bodyDepiction, makeCleanId(description))
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
