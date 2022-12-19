import {
  ContentObject,
  ExampleObject,
  ExamplesObject,
  MediaTypeObject,
  OAuthFlowsObject,
  ParameterObject,
  RequestBodyObject,
  ResponseObject,
  SchemaObject,
  SecurityRequirementObject,
  SecuritySchemeObject,
  TagObject,
} from "openapi3-ts";
import { omit } from "ramda";
import { z } from "zod";
import {
  ArrayElement,
  getExamples,
  getRoutePathParams,
  hasTopLevelTransformingEffect,
  routePathParamsRegex,
} from "./common-helpers";
import { InputSources, TagsConfig } from "./config-type";
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
}

type Depicter<
  T extends z.ZodTypeAny,
  Variant extends HandlingVariant = "regular"
> = SchemaHandler<T, SchemaObject, OpenAPIContext, Variant>;

interface ReqResDepictHelperCommonProps {
  method: Method;
  path: string;
  endpoint: AbstractEndpoint;
}

const shortDescriptionLimit = 50;
const isoDateDocumentationUrl =
  "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toISOString";

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
  next,
}) => ({
  type: "object",
  properties: depictObjectProperties({ schema, isResponse, next }),
  required: Object.keys(schema.shape).filter((key) => {
    const prop = schema.shape[key];
    return isResponse && hasCoercion(prop)
      ? prop instanceof z.ZodOptional
      : !prop.isOptional();
  }),
});

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
  isResponse,
  next,
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
        isResponse,
        next,
      }),
      required: keys,
    };
  }
  if (keySchema instanceof z.ZodLiteral) {
    return {
      type: "object",
      properties: depictObjectProperties({
        schema: z.object({
          [keySchema.value]: valueSchema,
        }),
        isResponse,
        next,
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
          isResponse,
          next,
        }),
        required: keySchema.options.map(
          (option: z.ZodLiteral<any>) => option.value
        ),
      };
    }
  }
  return {
    type: "object",
    additionalProperties: next({ schema: valueSchema }),
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
          .map((item, index) => `${index}: ${item.type}`)
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
    ...(minLength !== null && { minLength }),
    ...(maxLength !== null && { maxLength }),
    ...(regex && { pattern: `/${regex.source}/${regex.flags}` }),
  };
};

/** @todo support exclusive min/max as numbers in case of OpenAPI v3.1.x */
export const depictNumber: Depicter<z.ZodNumber> = ({ schema }) => {
  const minCheck = schema._def.checks.find(({ kind }) => kind === "min") as
    | Extract<ArrayElement<z.ZodNumberDef["checks"]>, { kind: "min" }>
    | undefined;
  const isMinInclusive = minCheck ? minCheck.inclusive : true;
  const maxCheck = schema._def.checks.find(({ kind }) => kind === "max") as
    | Extract<ArrayElement<z.ZodNumberDef["checks"]>, { kind: "max" }>
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
    {} as Record<string, SchemaObject>
  );
};

export const depictEffect: Depicter<z.ZodEffects<z.ZodTypeAny>> = ({
  schema,
  isResponse,
  next,
}) => {
  const input = next({ schema: schema._def.schema });
  const effect = schema._def.effect;
  if (isResponse && effect && effect.type === "transform") {
    let output = "undefined";
    try {
      output = typeof effect.transform(
        ["integer", "number"].includes(`${input.type}`)
          ? 0
          : "string" === input.type
          ? ""
          : "boolean" === input.type
          ? false
          : "object" === input.type
          ? {}
          : "null" === input.type
          ? null
          : "array" === input.type
          ? []
          : undefined,
        { addIssue: () => {}, path: [] }
      );
    } catch (e) {
      /**/
    }
    return {
      ...input,
      ...(["number", "string", "boolean"].includes(output) && {
        type: output as "number" | "string" | "boolean",
      }),
    };
  }
  if (!isResponse && effect && effect.type === "preprocess") {
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

export const depictIOExamples = <T extends IOSchema>(
  schema: T,
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

export const depictIOParamExamples = <T extends IOSchema>(
  schema: T,
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
}: ReqResDepictHelperCommonProps & {
  inputSources: InputSources[Method];
}): ParameterObject[] => {
  const schema = endpoint.getInputSchema();
  const shape = extractObjectSchema(schema).shape;
  const pathParams = getRoutePathParams(path);
  const isQueryEnabled = inputSources.includes("query");
  const isParamsEnabled = inputSources.includes("params");
  const isPathParam = (name: string) =>
    isParamsEnabled && pathParams.includes(name);
  return Object.keys(shape)
    .filter((name) => isQueryEnabled || isPathParam(name))
    .map((name) => ({
      name,
      in: isPathParam(name) ? "path" : "query",
      required: !shape[name].isOptional(),
      schema: {
        description: `${method.toUpperCase()} ${path} parameter`,
        ...walkSchema({
          schema: shape[name],
          isResponse: false,
          rules: depicters,
          onEach,
          onMissing,
        }),
      },
      ...depictIOParamExamples(schema, false, name),
    }));
};

export const depicters: HandlingRules<SchemaObject, OpenAPIContext> = {
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
};

/**
 * @desc isNullable() and isOptional() validate the schema's input
 * @desc They always return true in case of coercion, which should be taken into account when depicting response
 */
export const hasCoercion = (schema: z.ZodType): boolean =>
  "coerce" in schema._def && typeof schema._def.coerce === "boolean"
    ? schema._def.coerce
    : false;

export const onEach: Depicter<z.ZodTypeAny, "last"> = ({
  schema,
  isResponse,
}) => {
  const { description } = schema;
  const examples = getExamples(schema, isResponse);
  return {
    ...(description && { description }),
    ...(schema.isNullable() &&
      !(isResponse && hasCoercion(schema)) && { nullable: true }),
    ...(examples.length > 0 && { example: examples[0] }),
  };
};

export const onMissing = (schema: z.ZodTypeAny) => {
  throw new OpenAPIError(`Zod type ${schema.constructor.name} is unsupported`);
};

export const excludeParamsFromDepiction = (
  depicted: SchemaObject,
  pathParams: string[]
): SchemaObject => {
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
  depicted: SchemaObject
): SchemaObject => omit(["example"], depicted);

export const depictResponse = ({
  method,
  path,
  description,
  endpoint,
  isPositive,
}: ReqResDepictHelperCommonProps & {
  description: string;
  isPositive: boolean;
}): ResponseObject => {
  const schema = isPositive
    ? endpoint.getPositiveResponseSchema()
    : endpoint.getNegativeResponseSchema();
  const mimeTypes = isPositive
    ? endpoint.getPositiveMimeTypes()
    : endpoint.getNegativeMimeTypes();
  const depictedSchema = excludeExampleFromDepiction(
    walkSchema({
      schema,
      isResponse: true,
      rules: depicters,
      onEach,
      onMissing,
    })
  );
  const examples = depictIOExamples(schema, true);

  return {
    description: `${method.toUpperCase()} ${path} ${description}`,
    content: mimeTypes.reduce(
      (carry, mimeType) => ({
        ...carry,
        [mimeType]: {
          schema: depictedSchema,
          ...examples,
        },
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
}: ReqResDepictHelperCommonProps): RequestBodyObject => {
  const pathParams = getRoutePathParams(path);
  const bodyDepiction = excludeExampleFromDepiction(
    excludeParamsFromDepiction(
      walkSchema({
        schema: endpoint.getInputSchema(),
        isResponse: false,
        rules: depicters,
        onEach,
        onMissing,
      }),
      pathParams
    )
  );
  const bodyExamples = depictIOExamples(
    endpoint.getInputSchema(),
    false,
    pathParams
  );

  return {
    content: endpoint.getInputMimeTypes().reduce(
      (carry, mimeType) => ({
        ...carry,
        [mimeType]: {
          schema: {
            description: `${method.toUpperCase()} ${path} request body`,
            ...bodyDepiction,
          },
          ...bodyExamples,
        },
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
