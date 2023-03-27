import { createHash } from "crypto";
import {
  ContentObject,
  ExampleObject,
  ExamplesObject,
  MediaTypeObject,
  OAuthFlowsObject,
  ParameterObject,
  ReferenceObject,
  RequestBodyObject,
  ResponseObject,
  SchemaObject,
  SchemaObjectType,
  SecurityRequirementObject,
  SecuritySchemeObject,
  TagObject,
  isReferenceObject,
  isSchemaObject,
} from "openapi3-ts";
import { omit } from "ramda";
import { z } from "zod";
import {
  getExamples,
  getRoutePathParams,
  hasCoercion,
  hasTopLevelTransformingEffect,
  makeCleanId,
  routePathParamsRegex,
  tryToTransform,
} from "./common-helpers";
import { InputSource, TagsConfig } from "./config-type";
import { ZodDateIn, isoDateRegex } from "./date-in-schema";
import { ZodDateOut } from "./date-out-schema";
import { AbstractEndpoint } from "./endpoint";
import { OpenAPIError } from "./errors";
import { ZodFile } from "./file-schema";
import { IOSchema } from "./io-schema";
import {
  LogicalContainer,
  andToOr,
  mapLogicalContainer,
} from "./logical-container";
import { copyMeta } from "./metadata";
import { Method } from "./method";
import {
  HandlingRules,
  HandlingVariant,
  SchemaHandler,
  walkSchema,
} from "./schema-walker";
import { Security } from "./security";
import { ZodUpload } from "./upload-schema";

type MediaExamples = Pick<MediaTypeObject, "examples">;

export interface OpenAPIContext {
  isResponse: boolean;
  serializer: (schema: z.ZodTypeAny) => string;
  hasRef: (name: string) => boolean;
  makeRef: (
    name: string,
    schema: SchemaObject | ReferenceObject
  ) => ReferenceObject;
}

type Depicter<
  T extends z.ZodTypeAny,
  Variant extends HandlingVariant = "regular"
> = SchemaHandler<T, SchemaObject | ReferenceObject, OpenAPIContext, Variant>;

interface ReqResDepictHelperCommonProps
  extends Pick<OpenAPIContext, "serializer" | "hasRef" | "makeRef"> {
  method: Method;
  path: string;
  endpoint: AbstractEndpoint;
  composition: "inline" | "components";
  clue?: string;
}

const shortDescriptionLimit = 50;
const isoDateDocumentationUrl =
  "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toISOString";

const samples: Record<
  Exclude<NonNullable<SchemaObjectType>, Array<any>>,
  any
> = {
  integer: 0,
  number: 0,
  string: "",
  boolean: false,
  object: {},
  null: null,
  array: [],
};

/* eslint-disable @typescript-eslint/no-use-before-define */

export const reformatParamsInPath = (path: string) =>
  path.replace(routePathParamsRegex, (param) => `{${param.slice(1)}}`);

export const depictDefault: Depicter<z.ZodDefault<z.ZodTypeAny>> = ({
  schema: {
    _def: { innerType, defaultValue },
  },
  next,
}) => ({
  ...next({ schema: innerType }),
  default: defaultValue(),
});

export const depictCatch: Depicter<z.ZodCatch<z.ZodTypeAny>> = ({
  schema: {
    _def: { innerType },
  },
  next,
}) => next({ schema: innerType });

export const depictAny: Depicter<z.ZodAny> = () => ({
  format: "any",
});

export const depictUpload: Depicter<ZodUpload> = ({ isResponse }) => {
  if (isResponse) {
    throw new OpenAPIError("Please use z.upload() only for input.");
  }
  return {
    type: "string",
    format: "binary",
  };
};

export const depictFile: Depicter<ZodFile> = ({
  schema: { isBinary, isBase64 },
  isResponse,
}) => {
  if (!isResponse) {
    throw new OpenAPIError("Please use z.file() only within ResultHandler.");
  }
  return {
    type: "string",
    format: isBinary ? "binary" : isBase64 ? "byte" : "file",
  };
};

export const depictUnion: Depicter<
  z.ZodUnion<[z.ZodTypeAny, ...z.ZodTypeAny[]]>
> = ({ schema: { options }, next }) => ({
  oneOf: options.map((option) => next({ schema: option })),
});

export const depictDiscriminatedUnion: Depicter<
  z.ZodDiscriminatedUnion<string, z.ZodObject<any>[]>
> = ({ schema: { options, discriminator }, next }) => {
  return {
    discriminator: { propertyName: discriminator },
    oneOf: Array.from(options.values()).map((option) =>
      next({ schema: option })
    ),
  };
};

export const depictIntersection: Depicter<
  z.ZodIntersection<z.ZodTypeAny, z.ZodTypeAny>
> = ({
  schema: {
    _def: { left, right },
  },
  next,
}) => ({
  allOf: [left, right].map((entry) => next({ schema: entry })),
});

export const depictOptional: Depicter<z.ZodOptional<any>> = ({
  schema,
  next,
}) => next({ schema: schema.unwrap() });

export const depictNullable: Depicter<z.ZodNullable<any>> = ({
  schema,
  next,
}) => ({
  nullable: true,
  ...next({ schema: schema.unwrap() }),
});

export const depictEnum: Depicter<z.ZodEnum<any> | z.ZodNativeEnum<any>> = ({
  schema,
}) => ({
  type: typeof Object.values(schema.enum)[0] as "string" | "number",
  enum: Object.values(schema.enum),
});

export const depictLiteral: Depicter<z.ZodLiteral<any>> = ({
  schema: { value },
}) => ({
  type: typeof value as "string" | "number" | "boolean",
  enum: [value],
});

export const depictObject: Depicter<z.AnyZodObject> = ({
  schema,
  isResponse,
  ...rest
}) => {
  const required = Object.keys(schema.shape).filter((key) => {
    const prop = schema.shape[key];
    const isOptional =
      isResponse && hasCoercion(prop)
        ? prop instanceof z.ZodOptional
        : prop.isOptional();
    return !isOptional;
  });
  return {
    type: "object",
    properties: depictObjectProperties({ schema, isResponse, ...rest }),
    ...(required.length ? { required } : {}),
  };
};

/**
 * @see https://swagger.io/docs/specification/data-models/data-types/
 * @todo use type:"null" for OpenAPI 3.1
 * */
export const depictNull: Depicter<z.ZodNull> = () => ({
  type: "string",
  nullable: true,
  format: "null",
});

export const depictDateIn: Depicter<ZodDateIn> = ({ isResponse }) => {
  if (isResponse) {
    throw new OpenAPIError("Please use z.dateOut() for output.");
  }
  return {
    description: "YYYY-MM-DDTHH:mm:ss.sssZ",
    type: "string",
    format: "date-time",
    pattern: isoDateRegex.source,
    externalDocs: {
      url: isoDateDocumentationUrl,
    },
  };
};

export const depictDateOut: Depicter<ZodDateOut> = ({ isResponse }) => {
  if (!isResponse) {
    throw new OpenAPIError("Please use z.dateIn() for input.");
  }
  return {
    description: "YYYY-MM-DDTHH:mm:ss.sssZ",
    type: "string",
    format: "date-time",
    externalDocs: {
      url: isoDateDocumentationUrl,
    },
  };
};

/** @throws OpenAPIError */
export const depictDate: Depicter<z.ZodDate> = ({ isResponse }) => {
  throw new OpenAPIError(
    `Using z.date() within ${
      isResponse ? "output" : "input"
    } schema is forbidden. Please use z.date${
      isResponse ? "Out" : "In"
    }() instead. Check out the documentation for details.`
  );
};

export const depictBoolean: Depicter<z.ZodBoolean> = () => ({
  type: "boolean",
});

export const depictBigInt: Depicter<z.ZodBigInt> = () => ({
  type: "integer",
  format: "bigint",
});

export const depictRecord: Depicter<z.ZodRecord<z.ZodTypeAny>> = ({
  schema: { keySchema, valueSchema },
  ...rest
}) => {
  if (keySchema instanceof z.ZodEnum || keySchema instanceof z.ZodNativeEnum) {
    const keys = Object.values(keySchema.enum) as string[];
    const shape = keys.reduce(
      (carry, key) => ({
        ...carry,
        [key]: valueSchema,
      }),
      {} as z.ZodRawShape
    );
    return {
      type: "object",
      properties: depictObjectProperties({
        schema: z.object(shape),
        ...rest,
      }),
      ...(keys.length ? { required: keys } : {}),
    };
  }
  if (keySchema instanceof z.ZodLiteral) {
    return {
      type: "object",
      properties: depictObjectProperties({
        schema: z.object({
          [keySchema.value]: valueSchema,
        }),
        ...rest,
      }),
      required: [keySchema.value],
    };
  }
  if (keySchema instanceof z.ZodUnion) {
    const areOptionsLiteral = keySchema.options.reduce(
      (carry: boolean, option: z.ZodTypeAny) =>
        carry && option instanceof z.ZodLiteral,
      true
    );
    if (areOptionsLiteral) {
      const shape = keySchema.options.reduce(
        (carry: z.ZodRawShape, option: z.ZodLiteral<any>) => ({
          ...carry,
          [option.value]: valueSchema,
        }),
        {} as z.ZodRawShape
      );
      return {
        type: "object",
        properties: depictObjectProperties({
          schema: z.object(shape),
          ...rest,
        }),
        required: keySchema.options.map(
          (option: z.ZodLiteral<any>) => option.value
        ),
      };
    }
  }
  return {
    type: "object",
    additionalProperties: rest.next({ schema: valueSchema }),
  };
};

export const depictArray: Depicter<z.ZodArray<z.ZodTypeAny>> = ({
  schema: { _def: def, element },
  next,
}) => ({
  type: "array",
  items: next({ schema: element }),
  ...(def.minLength !== null && { minItems: def.minLength.value }),
  ...(def.maxLength !== null && { maxItems: def.maxLength.value }),
});

/** @todo improve it when OpenAPI 3.1.0 will be released */
export const depictTuple: Depicter<z.ZodTuple> = ({
  schema: { items },
  next,
}) => {
  const types = items.map((item) => next({ schema: item }));
  return {
    type: "array",
    minItems: types.length,
    maxItems: types.length,
    items: {
      oneOf: types,
      format: "tuple",
      ...(types.length > 0 && {
        description: types
          .map(
            (item, index) =>
              `${index}: ${isSchemaObject(item) ? item.type : item.$ref}`
          )
          .join(", "),
      }),
    },
  };
};

export const depictString: Depicter<z.ZodString> = ({
  schema: {
    isEmail,
    isURL,
    minLength,
    maxLength,
    isUUID,
    isCUID,
    isCUID2,
    isULID,
    isIP,
    isEmoji,
    isDatetime,
    _def: { checks },
  },
}) => {
  const regexCheck = checks.find(
    (check): check is z.ZodStringCheck & { kind: "regex" } =>
      check.kind === "regex"
  );
  const datetimeCheck = checks.find(
    (check): check is z.ZodStringCheck & { kind: "datetime" } =>
      check.kind === "datetime"
  );
  const regex = regexCheck
    ? regexCheck.regex
    : datetimeCheck
    ? datetimeCheck.offset
      ? new RegExp(
          `^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?(([+-]\\d{2}:\\d{2})|Z)$`
        )
      : new RegExp(`^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z$`)
    : undefined;
  return {
    type: "string" as const,
    ...(isDatetime && { format: "date-time" }),
    ...(isEmail && { format: "email" }),
    ...(isURL && { format: "url" }),
    ...(isUUID && { format: "uuid" }),
    ...(isCUID && { format: "cuid" }),
    ...(isCUID2 && { format: "cuid2" }),
    ...(isULID && { format: "ulid" }),
    ...(isIP && { format: "ip" }),
    ...(isEmoji && { format: "emoji" }),
    ...(minLength !== null && { minLength }),
    ...(maxLength !== null && { maxLength }),
    ...(regex && { pattern: `/${regex.source}/${regex.flags}` }),
  };
};

/** @todo support exclusive min/max as numbers in case of OpenAPI v3.1.x */
export const depictNumber: Depicter<z.ZodNumber> = ({ schema }) => {
  const minCheck = schema._def.checks.find(({ kind }) => kind === "min") as
    | Extract<z.ZodNumberCheck, { kind: "min" }>
    | undefined;
  const isMinInclusive = minCheck ? minCheck.inclusive : true;
  const maxCheck = schema._def.checks.find(({ kind }) => kind === "max") as
    | Extract<z.ZodNumberCheck, { kind: "max" }>
    | undefined;
  const isMaxInclusive = maxCheck ? maxCheck.inclusive : true;
  return {
    type: schema.isInt ? ("integer" as const) : ("number" as const),
    format: schema.isInt ? ("int64" as const) : ("double" as const),
    minimum:
      schema.minValue === null
        ? schema.isInt
          ? Number.MIN_SAFE_INTEGER
          : Number.MIN_VALUE
        : schema.minValue,
    exclusiveMinimum: !isMinInclusive,
    maximum:
      schema.maxValue === null
        ? schema.isInt
          ? Number.MAX_SAFE_INTEGER
          : Number.MAX_VALUE
        : schema.maxValue,
    exclusiveMaximum: !isMaxInclusive,
  };
};

export const depictObjectProperties = ({
  schema: { shape },
  next,
}: Parameters<Depicter<z.AnyZodObject>>[0]) => {
  return Object.keys(shape).reduce(
    (carry, key) => ({
      ...carry,
      [key]: next({ schema: shape[key] }),
    }),
    {} as Record<string, SchemaObject | ReferenceObject>
  );
};

const makeSample = (depicted: SchemaObject) => {
  const type = (
    Array.isArray(depicted.type) ? depicted.type[0] : depicted.type
  ) as keyof typeof samples;
  return samples?.[type];
};

export const depictEffect: Depicter<z.ZodEffects<z.ZodTypeAny>> = ({
  schema,
  isResponse,
  next,
}) => {
  const input = next({ schema: schema.innerType() });
  const { effect } = schema._def;
  if (isResponse && effect.type === "transform" && isSchemaObject(input)) {
    const outputType = tryToTransform({ effect, sample: makeSample(input) });
    if (outputType && ["number", "string", "boolean"].includes(outputType)) {
      return { type: outputType as "number" | "string" | "boolean" };
    } else {
      return next({ schema: z.any() });
    }
  }
  if (!isResponse && effect.type === "preprocess" && isSchemaObject(input)) {
    const { type: inputType, ...rest } = input;
    return {
      ...rest,
      format: `${rest.format || inputType} (preprocessed)`,
    };
  }
  return input;
};

export const depictPipeline: Depicter<z.ZodPipeline<any, any>> = ({
  schema,
  isResponse,
  next,
}) => next({ schema: schema._def[isResponse ? "out" : "in"] });

export const depictBranded: Depicter<z.ZodBranded<z.ZodTypeAny, any>> = ({
  schema,
  next,
}) => next({ schema: schema.unwrap() });

export const defaultSerializer = (schema: z.ZodTypeAny): string =>
  createHash("sha1").update(JSON.stringify(schema), "utf8").digest("hex");

export const depictLazy: Depicter<z.ZodLazy<z.ZodTypeAny>> = ({
  next,
  schema: lazy,
  serializer: serialize,
  hasRef,
  makeRef,
}): ReferenceObject => {
  const hash = serialize(lazy.schema);
  if (hasRef(hash)) {
    return { $ref: `#/components/schemas/${hash}` }; // @todo consider changing it to getRef that return ReferenceObject
  }
  const ref = makeRef(hash, {}); // make empty ref first
  makeRef(hash, next({ schema: lazy.schema })); // update
  return ref;
};

export const depictExamples = (
  schema: z.ZodTypeAny,
  isResponse: boolean,
  omitProps: string[] = []
): MediaExamples => {
  const examples = getExamples(schema, isResponse);
  if (examples.length === 0) {
    return {};
  }
  return {
    examples: examples.reduce<ExamplesObject>(
      (carry, example, index) => ({
        ...carry,
        [`example${index + 1}`]: <ExampleObject>{
          value: omit(omitProps, example),
        },
      }),
      {}
    ),
  };
};

export const depictParamExamples = (
  schema: z.ZodTypeAny,
  isResponse: boolean,
  param: string
): MediaExamples => {
  const examples = getExamples(schema, isResponse);
  if (examples.length === 0) {
    return {};
  }
  return {
    examples: examples.reduce<ExamplesObject>(
      (carry, example, index) =>
        param in example
          ? {
              ...carry,
              [`example${index + 1}`]: <ExampleObject>{
                value: example[param],
              },
            }
          : carry,
      {}
    ),
  };
};

export function extractObjectSchema(subject: IOSchema) {
  if (subject instanceof z.ZodObject) {
    return subject;
  }
  let objectSchema: z.AnyZodObject;
  if (
    subject instanceof z.ZodUnion ||
    subject instanceof z.ZodDiscriminatedUnion
  ) {
    objectSchema = Array.from(subject.options.values())
      .map((option) => extractObjectSchema(option))
      .reduce((acc, option) => acc.merge(option.partial()), z.object({}));
  } else if (subject instanceof z.ZodEffects) {
    if (hasTopLevelTransformingEffect(subject)) {
      throw new OpenAPIError(
        "Using transformations on the top level of input schema is not allowed."
      );
    }
    objectSchema = extractObjectSchema(subject._def.schema); // object refinement
  } else {
    // intersection
    objectSchema = extractObjectSchema(subject._def.left).merge(
      extractObjectSchema(subject._def.right)
    );
  }
  return copyMeta(subject, objectSchema);
}

export const depictRequestParams = ({
  path,
  method,
  endpoint,
  inputSources,
  serializer,
  hasRef,
  makeRef,
  composition,
  clue = "parameter",
}: ReqResDepictHelperCommonProps & {
  inputSources: InputSource[];
}): ParameterObject[] => {
  const schema = endpoint.getSchema("input");
  const shape = extractObjectSchema(schema).shape;
  const pathParams = getRoutePathParams(path);
  const isQueryEnabled = inputSources.includes("query");
  const isParamsEnabled = inputSources.includes("params");
  const isPathParam = (name: string) =>
    isParamsEnabled && pathParams.includes(name);
  return Object.keys(shape)
    .filter((name) => isQueryEnabled || isPathParam(name))
    .map((name) => {
      const depicted = walkSchema({
        schema: shape[name],
        isResponse: false,
        rules: depicters,
        onEach,
        onMissing,
        serializer,
        hasRef,
        makeRef,
      });
      const result =
        composition === "components"
          ? makeRef(makeCleanId(path, method, `${clue} ${name}`), depicted)
          : depicted;
      return {
        name,
        in: isPathParam(name) ? "path" : "query",
        required: !shape[name].isOptional(),
        description: `${method.toUpperCase()} ${path} ${clue}`,
        schema: result,
        ...depictParamExamples(schema, false, name),
      };
    });
};

export const depicters: HandlingRules<
  SchemaObject | ReferenceObject,
  OpenAPIContext
> = {
  ZodString: depictString,
  ZodNumber: depictNumber,
  ZodBigInt: depictBigInt,
  ZodBoolean: depictBoolean,
  ZodDateIn: depictDateIn,
  ZodDateOut: depictDateOut,
  ZodNull: depictNull,
  ZodArray: depictArray,
  ZodTuple: depictTuple,
  ZodRecord: depictRecord,
  ZodObject: depictObject,
  ZodLiteral: depictLiteral,
  ZodIntersection: depictIntersection,
  ZodUnion: depictUnion,
  ZodFile: depictFile,
  ZodUpload: depictUpload,
  ZodAny: depictAny,
  ZodDefault: depictDefault,
  ZodEnum: depictEnum,
  ZodNativeEnum: depictEnum,
  ZodEffects: depictEffect,
  ZodOptional: depictOptional,
  ZodNullable: depictNullable,
  ZodDiscriminatedUnion: depictDiscriminatedUnion,
  ZodBranded: depictBranded,
  ZodDate: depictDate,
  ZodCatch: depictCatch,
  ZodPipeline: depictPipeline,
  ZodLazy: depictLazy,
};

export const onEach: Depicter<z.ZodTypeAny, "each"> = ({
  schema,
  isResponse,
  prev,
}) => {
  if (isReferenceObject(prev)) {
    return {};
  }
  const { description } = schema;
  const shouldAvoidParsing = schema instanceof z.ZodLazy;
  const hasTypePropertyInDepiction = prev.type !== undefined;
  const isResponseHavingCoercion = isResponse && hasCoercion(schema);
  const isActuallyNullable =
    !shouldAvoidParsing &&
    hasTypePropertyInDepiction &&
    !isResponseHavingCoercion &&
    schema.isNullable();
  const examples = shouldAvoidParsing ? [] : getExamples(schema, isResponse);
  return {
    ...(description && { description }),
    ...(isActuallyNullable && { nullable: true }),
    ...(examples.length > 0 && { example: examples[0] }),
  };
};

export const onMissing = (schema: z.ZodTypeAny) => {
  throw new OpenAPIError(`Zod type ${schema.constructor.name} is unsupported`);
};

export const excludeParamsFromDepiction = (
  depicted: SchemaObject | ReferenceObject,
  pathParams: string[]
): SchemaObject | ReferenceObject => {
  if (isReferenceObject(depicted)) {
    return depicted;
  }
  const properties = depicted.properties
    ? omit(pathParams, depicted.properties)
    : undefined;
  const example = depicted.example
    ? omit(pathParams, depicted.example)
    : undefined;
  const required = depicted.required
    ? depicted.required.filter((name) => !pathParams.includes(name))
    : undefined;
  const allOf = depicted.allOf
    ? (depicted.allOf as SchemaObject[]).map((entry) =>
        excludeParamsFromDepiction(entry, pathParams)
      )
    : undefined;
  const oneOf = depicted.oneOf
    ? (depicted.oneOf as SchemaObject[]).map((entry) =>
        excludeParamsFromDepiction(entry, pathParams)
      )
    : undefined;

  return omit(
    Object.entries({ properties, required, example, allOf, oneOf })
      .filter(([{}, value]) => value === undefined)
      .map(([key]) => key),
    {
      ...depicted,
      properties,
      required,
      example,
      allOf,
      oneOf,
    }
  );
};

export const excludeExampleFromDepiction = (
  depicted: SchemaObject | ReferenceObject
): SchemaObject | ReferenceObject =>
  isSchemaObject(depicted) ? omit(["example"], depicted) : depicted;

export const depictResponse = ({
  method,
  path,
  endpoint,
  isPositive,
  serializer,
  hasRef,
  makeRef,
  composition,
  clue = "response",
}: ReqResDepictHelperCommonProps & {
  isPositive: boolean;
}): ResponseObject => {
  const schema = endpoint.getSchema(isPositive ? "positive" : "negative");
  const mimeTypes = endpoint.getMimeTypes(isPositive ? "positive" : "negative");
  const depictedSchema = excludeExampleFromDepiction(
    walkSchema({
      schema,
      isResponse: true,
      rules: depicters,
      onEach,
      onMissing,
      serializer,
      hasRef,
      makeRef,
    })
  );
  const examples = depictExamples(schema, true);
  const result =
    composition === "components"
      ? makeRef(makeCleanId(path, method, clue), depictedSchema)
      : depictedSchema;

  return {
    description: `${method.toUpperCase()} ${path} ${clue}`,
    content: mimeTypes.reduce(
      (carry, mimeType) => ({
        ...carry,
        [mimeType]: { schema: result, ...examples },
      }),
      {} as ContentObject
    ),
  };
};

type SecurityHelper<K extends Security["type"]> = (
  security: Security & { type: K }
) => SecuritySchemeObject;

const depictBasicSecurity: SecurityHelper<"basic"> = () => ({
  type: "http",
  scheme: "basic",
});
const depictBearerSecurity: SecurityHelper<"bearer"> = ({
  format: bearerFormat,
}) => ({
  type: "http",
  scheme: "bearer",
  ...(bearerFormat && { bearerFormat }),
});
// @todo add description on actual input placement
const depictInputSecurity: SecurityHelper<"input"> = ({ name }) => ({
  type: "apiKey",
  in: "query", // body is not supported yet, https://swagger.io/docs/specification/authentication/api-keys/
  name,
});
const depictHeaderSecurity: SecurityHelper<"header"> = ({ name }) => ({
  type: "apiKey",
  in: "header",
  name,
});
const depictCookieSecurity: SecurityHelper<"cookie"> = ({ name }) => ({
  type: "apiKey",
  in: "cookie",
  name,
});
const depictOpenIdSecurity: SecurityHelper<"openid"> = ({
  url: openIdConnectUrl,
}) => ({
  type: "openIdConnect",
  openIdConnectUrl,
});
const depictOAuth2Security: SecurityHelper<"oauth2"> = ({ flows = {} }) => ({
  type: "oauth2",
  flows: (
    Object.keys(flows) as (keyof typeof flows)[]
  ).reduce<OAuthFlowsObject>((acc, key) => {
    const flow = flows[key];
    if (!flow) {
      return acc;
    }
    const { scopes = {}, ...rest } = flow;
    return { ...acc, [key]: { ...rest, scopes } };
  }, {}),
});

export const depictSecurity = (
  container: LogicalContainer<Security>
): LogicalContainer<SecuritySchemeObject> => {
  const methods: { [K in Security["type"]]: SecurityHelper<K> } = {
    basic: depictBasicSecurity,
    bearer: depictBearerSecurity,
    input: depictInputSecurity,
    header: depictHeaderSecurity,
    cookie: depictCookieSecurity,
    openid: depictOpenIdSecurity,
    oauth2: depictOAuth2Security,
  };
  return mapLogicalContainer(container, (security) =>
    (methods[security.type] as SecurityHelper<typeof security.type>)(security)
  );
};

export const depictSecurityRefs = (
  container: LogicalContainer<{ name: string; scopes: string[] }>
): SecurityRequirementObject[] => {
  if (typeof container === "object") {
    if ("or" in container) {
      return container.or.map((entry) =>
        ("and" in entry
          ? entry.and
          : [entry]
        ).reduce<SecurityRequirementObject>(
          (agg, { name, scopes }) => ({
            ...agg,
            [name]: scopes,
          }),
          {}
        )
      );
    }
    if ("and" in container) {
      return depictSecurityRefs(andToOr(container));
    }
  }
  return depictSecurityRefs({ or: [container] });
};

export const depictRequest = ({
  method,
  path,
  endpoint,
  serializer,
  hasRef,
  makeRef,
  composition,
  clue = "request body",
}: ReqResDepictHelperCommonProps): RequestBodyObject => {
  const pathParams = getRoutePathParams(path);
  const bodyDepiction = excludeExampleFromDepiction(
    excludeParamsFromDepiction(
      walkSchema({
        schema: endpoint.getSchema("input"),
        isResponse: false,
        rules: depicters,
        onEach,
        onMissing,
        serializer,
        hasRef,
        makeRef,
      }),
      pathParams
    )
  );
  const bodyExamples = depictExamples(
    endpoint.getSchema("input"),
    false,
    pathParams
  );
  const result =
    composition === "components"
      ? makeRef(makeCleanId(path, method, clue), bodyDepiction)
      : bodyDepiction;

  return {
    description: `${method.toUpperCase()} ${path} ${clue}`,
    content: endpoint.getMimeTypes("input").reduce(
      (carry, mimeType) => ({
        ...carry,
        [mimeType]: { schema: result, ...bodyExamples },
      }),
      {} as ContentObject
    ),
  };
};

export const depictTags = <TAG extends string>(
  tags: TagsConfig<TAG>
): TagObject[] =>
  (Object.keys(tags) as TAG[]).map((tag) => {
    const def = tags[tag];
    return {
      name: tag,
      description: typeof def === "string" ? def : def.description,
      ...(typeof def === "object" &&
        def.url && { externalDocs: { url: def.url } }),
    };
  });

export const ensureShortDescription = (description: string) => {
  if (description.length <= shortDescriptionLimit) {
    return description;
  }
  return description.slice(0, shortDescriptionLimit - 1) + "…";
};
