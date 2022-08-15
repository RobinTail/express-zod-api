import {
  ContentObject,
  ExampleObject,
  ExamplesObject,
  MediaTypeObject,
  ParameterObject,
  SchemaObject,
} from "openapi3-ts";
import {
  RequestBodyObject,
  ResponseObject,
  SecurityRequirementObject,
  SecuritySchemeObject,
} from "openapi3-ts/src/model/OpenApi";
import { omit } from "ramda";
import { z } from "zod";
import {
  ArrayElement,
  getExamples,
  getRoutePathParams,
  IOSchema,
  routePathParamsRegex,
} from "./common-helpers";
import { InputSources } from "./config-type";
import { isoDateRegex, ZodDateIn, ZodDateInDef } from "./date-in-schema";
import { ZodDateOut, ZodDateOutDef } from "./date-out-schema";
import { AbstractEndpoint } from "./endpoint";
import { OpenAPIError } from "./errors";
import { ZodFile, ZodFileDef } from "./file-schema";
import {
  andToOr,
  LogicalContainer,
  mapLogicalContainer,
} from "./logical-container";
import { copyMeta } from "./metadata";
import { Method } from "./method";
import { Security } from "./security";
import { ZodUpload, ZodUploadDef } from "./upload-schema";

type MediaExamples = Pick<MediaTypeObject, "examples">;

type DepictHelper<T extends z.ZodType<any>> = (params: {
  schema: T;
  initial?: SchemaObject;
  isResponse: boolean;
}) => SchemaObject;

type DepictingRules = Partial<
  Record<
    | z.ZodFirstPartyTypeKind
    | ZodFileDef["typeName"]
    | ZodUploadDef["typeName"]
    | ZodDateInDef["typeName"]
    | ZodDateOutDef["typeName"],
    DepictHelper<any>
  >
>;

interface ReqResDepictHelperCommonProps {
  method: Method;
  path: string;
  endpoint: AbstractEndpoint;
}

const isoDateDocumentationUrl =
  "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toISOString";

/* eslint-disable @typescript-eslint/no-use-before-define */

export const reformatParamsInPath = (path: string) =>
  path.replace(routePathParamsRegex, (param) => `{${param.slice(1)}}`);

export const depictDefault: DepictHelper<z.ZodDefault<z.ZodTypeAny>> = ({
  schema: {
    _def: { innerType, defaultValue },
  },
  initial,
  isResponse,
}) => ({
  ...initial,
  ...depictSchema({ schema: innerType, initial, isResponse }),
  default: defaultValue(),
});

export const depictAny: DepictHelper<z.ZodAny> = ({ initial }) => ({
  ...initial,
  format: "any",
});

export const depictUpload: DepictHelper<ZodUpload> = ({
  initial,
  isResponse,
}) => {
  if (isResponse) {
    throw new OpenAPIError("Please use z.upload() only for input.");
  }
  return {
    ...initial,
    type: "string",
    format: "binary",
  };
};

export const depictFile: DepictHelper<ZodFile> = ({
  schema: { isBinary, isBase64 },
  initial,
}) => ({
  ...initial,
  type: "string",
  format: isBinary ? "binary" : isBase64 ? "byte" : "file",
});

export const depictUnion: DepictHelper<
  z.ZodUnion<[z.ZodTypeAny, ...z.ZodTypeAny[]]>
> = ({ schema: { options }, initial, isResponse }) => ({
  ...initial,
  oneOf: options.map((option) => depictSchema({ schema: option, isResponse })),
});

export const depictDiscriminatedUnion: DepictHelper<
  z.ZodDiscriminatedUnion<string, z.Primitive, z.ZodObject<any>>
> = ({ schema: { options, discriminator }, initial, isResponse }) => {
  return {
    ...initial,
    discriminator: {
      propertyName: discriminator,
    },
    oneOf: Array.from(options.values()).map((option) =>
      depictSchema({ schema: option, isResponse })
    ),
  };
};

export const depictIntersection: DepictHelper<
  z.ZodIntersection<z.ZodTypeAny, z.ZodTypeAny>
> = ({
  schema: {
    _def: { left, right },
  },
  initial,
  isResponse,
}) => ({
  ...initial,
  allOf: [
    depictSchema({ schema: left, isResponse }),
    depictSchema({ schema: right, isResponse }),
  ],
});

export const depictOptionalOrNullable: DepictHelper<
  z.ZodOptional<any> | z.ZodNullable<any>
> = ({ schema, initial, isResponse }) => ({
  ...initial,
  ...depictSchema({ schema: schema.unwrap(), isResponse }),
});

export const depictEnum: DepictHelper<
  z.ZodEnum<any> | z.ZodNativeEnum<any>
> = ({
  schema: {
    _def: { values },
  },
  initial,
}) => ({
  ...initial,
  type: typeof Object.values(values)[0] as "string" | "number",
  enum: Object.values(values),
});

export const depictLiteral: DepictHelper<z.ZodLiteral<any>> = ({
  schema: {
    _def: { value },
  },
  initial,
}) => ({
  ...initial,
  type: typeof value as "string" | "number" | "boolean",
  enum: [value],
});

export const depictObject: DepictHelper<z.AnyZodObject> = ({
  schema,
  initial,
  isResponse,
}) => ({
  ...initial,
  type: "object",
  properties: depictObjectProperties({ schema, isResponse }),
  required: Object.keys(schema.shape).filter(
    (key) => !schema.shape[key].isOptional()
  ),
});

/** @see https://swagger.io/docs/specification/data-models/data-types/ */
export const depictNull: DepictHelper<z.ZodNull> = ({ initial }) => ({
  ...initial,
  type: "string",
  nullable: true,
  format: "null",
});

export const depictDateIn: DepictHelper<ZodDateIn> = ({
  initial,
  isResponse,
}) => {
  if (isResponse) {
    throw new OpenAPIError("Please use z.dateOut() for output.");
  }
  return {
    ...initial,
    type: "string",
    format: "date-time",
    pattern: isoDateRegex.source,
    description: "YYYY-MM-DDTHH:mm:ss.sssZ",
    externalDocs: {
      url: isoDateDocumentationUrl,
    },
  };
};

export const depictDateOut: DepictHelper<ZodDateOut> = ({
  initial,
  isResponse,
}) => {
  if (!isResponse) {
    throw new OpenAPIError("Please use z.dateIn() for input.");
  }
  return {
    ...initial,
    type: "string",
    format: "date-time",
    description: "YYYY-MM-DDTHH:mm:ss.sssZ",
    externalDocs: {
      url: isoDateDocumentationUrl,
    },
  };
};

export const depictBoolean: DepictHelper<z.ZodBoolean> = ({ initial }) => ({
  ...initial,
  type: "boolean",
});

export const depictBigInt: DepictHelper<z.ZodBigInt> = ({ initial }) => ({
  ...initial,
  type: "integer",
  format: "bigint",
});

export const depictRecord: DepictHelper<z.ZodRecord<z.ZodTypeAny>> = ({
  schema: { _def: def },
  initial,
  isResponse,
}) => {
  if (
    def.keyType instanceof z.ZodEnum ||
    def.keyType instanceof z.ZodNativeEnum
  ) {
    const keys = Object.values(def.keyType._def.values) as string[];
    const shape = keys.reduce(
      (carry, key) => ({
        ...carry,
        [key]: def.valueType,
      }),
      {} as z.ZodRawShape
    );
    return {
      ...initial,
      type: "object",
      properties: depictObjectProperties({
        schema: z.object(shape),
        isResponse,
      }),
      required: keys,
    };
  }
  if (def.keyType instanceof z.ZodLiteral) {
    return {
      ...initial,
      type: "object",
      properties: depictObjectProperties({
        schema: z.object({
          [def.keyType._def.value]: def.valueType,
        }),
        isResponse,
      }),
      required: [def.keyType._def.value],
    };
  }
  if (def.keyType instanceof z.ZodUnion) {
    const areOptionsLiteral = def.keyType.options.reduce(
      (carry: boolean, option: z.ZodTypeAny) =>
        carry && option instanceof z.ZodLiteral,
      true
    );
    if (areOptionsLiteral) {
      const shape = def.keyType.options.reduce(
        (carry: z.ZodRawShape, option: z.ZodLiteral<any>) => ({
          ...carry,
          [option.value]: def.valueType,
        }),
        {} as z.ZodRawShape
      );
      return {
        ...initial,
        type: "object",
        properties: depictObjectProperties({
          schema: z.object(shape),
          isResponse,
        }),
        required: def.keyType.options.map(
          (option: z.ZodLiteral<any>) => option.value
        ),
      };
    }
  }
  return {
    ...initial,
    type: "object",
    additionalProperties: depictSchema({ schema: def.valueType, isResponse }),
  };
};

export const depictArray: DepictHelper<z.ZodArray<z.ZodTypeAny>> = ({
  schema: { _def: def },
  initial,
  isResponse,
}) => ({
  ...initial,
  type: "array",
  items: depictSchema({ schema: def.type, isResponse }),
  ...(def.minLength ? { minItems: def.minLength.value } : {}),
  ...(def.maxLength ? { maxItems: def.maxLength.value } : {}),
});

/** @todo improve it when OpenAPI 3.1.0 will be released */
export const depictTuple: DepictHelper<z.ZodTuple> = ({
  schema: { items },
  initial,
  isResponse,
}) => {
  const types = items.map((item) => depictSchema({ schema: item, isResponse }));
  return {
    ...initial,
    type: "array",
    minItems: types.length,
    maxItems: types.length,
    items: {
      oneOf: types,
      format: "tuple",
      ...(types.length === 0
        ? {}
        : {
            description: types
              .map((item, index) => `${index}: ${item.type}`)
              .join(", "),
          }),
    },
  };
};

export const depictString: DepictHelper<z.ZodString> = ({
  schema: {
    _def: { checks },
  },
  initial,
}) => {
  const isEmail = checks.find(({ kind }) => kind === "email") !== undefined;
  const isUrl = checks.find(({ kind }) => kind === "url") !== undefined;
  const isUUID = checks.find(({ kind }) => kind === "uuid") !== undefined;
  const isCUID = checks.find(({ kind }) => kind === "cuid") !== undefined;
  const minLengthCheck = checks.find(({ kind }) => kind === "min") as
    | Extract<ArrayElement<z.ZodStringDef["checks"]>, { kind: "min" }>
    | undefined;
  const maxLengthCheck = checks.find(({ kind }) => kind === "max") as
    | Extract<ArrayElement<z.ZodStringDef["checks"]>, { kind: "max" }>
    | undefined;
  const regexCheck = checks.find(({ kind }) => kind === "regex") as
    | Extract<ArrayElement<z.ZodStringDef["checks"]>, { kind: "regex" }>
    | undefined;
  return {
    ...initial,
    type: "string" as const,
    ...(isEmail ? { format: "email" } : {}),
    ...(isUrl ? { format: "url" } : {}),
    ...(isUUID ? { format: "uuid" } : {}),
    ...(isCUID ? { format: "cuid" } : {}),
    ...(minLengthCheck ? { minLength: minLengthCheck.value } : {}),
    ...(maxLengthCheck ? { maxLength: maxLengthCheck.value } : {}),
    ...(regexCheck
      ? { pattern: `/${regexCheck.regex.source}/${regexCheck.regex.flags}` }
      : {}),
  };
};

export const depictNumber: DepictHelper<z.ZodNumber> = ({
  schema,
  initial,
}) => {
  const minCheck = schema._def.checks.find(({ kind }) => kind === "min") as
    | Extract<ArrayElement<z.ZodNumberDef["checks"]>, { kind: "min" }>
    | undefined;
  const isMinInclusive = minCheck ? minCheck.inclusive : true;
  const maxCheck = schema._def.checks.find(({ kind }) => kind === "max") as
    | Extract<ArrayElement<z.ZodNumberDef["checks"]>, { kind: "max" }>
    | undefined;
  const isMaxInclusive = maxCheck ? maxCheck.inclusive : true;
  return {
    ...initial,
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
  isResponse,
}: Parameters<DepictHelper<z.AnyZodObject>>[0]) => {
  return Object.keys(shape).reduce(
    (carry, key) => ({
      ...carry,
      [key]: depictSchema({ schema: shape[key], isResponse }),
    }),
    {} as Record<string, SchemaObject>
  );
};

export const depictEffect: DepictHelper<z.ZodEffects<z.ZodTypeAny>> = ({
  schema,
  initial,
  isResponse,
}) => {
  const input = depictSchema({ schema: schema._def.schema, isResponse });
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
      ...initial,
      ...input,
      ...(["number", "string", "boolean"].includes(output)
        ? {
            type: output as "number" | "string" | "boolean",
          }
        : {}),
    };
  }
  if (!isResponse && effect && effect.type === "preprocess") {
    const { type: inputType, ...rest } = input;
    return {
      ...initial,
      ...rest,
      format: `${rest.format || inputType} (preprocessed)`,
    };
  }
  return { ...initial, ...input };
};

export const depictZodBranded: DepictHelper<
  z.ZodBranded<z.ZodTypeAny, any>
> = ({ schema, initial, isResponse }) =>
  depictSchema({ schema: schema.unwrap(), isResponse, initial });

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
  } else {
    // intersection schema
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
        ...depictSchema({ schema: shape[name], isResponse: false }),
      },
      ...depictIOParamExamples(schema, false, name),
    }));
};

const depictHelpers: DepictingRules = {
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
  ZodOptional: depictOptionalOrNullable,
  ZodNullable: depictOptionalOrNullable,
  ZodDiscriminatedUnion: depictDiscriminatedUnion,
  ZodBranded: depictZodBranded,
};

export const depictSchema: DepictHelper<z.ZodTypeAny> = ({
  schema,
  isResponse,
}) => {
  const initial: SchemaObject = {};
  if (schema.isNullable()) {
    initial.nullable = true;
  }
  if (schema.description) {
    initial.description = `${schema.description}`;
  }
  const examples = getExamples(schema, isResponse);
  if (examples.length > 0) {
    initial.example = examples[0];
  }
  const nextHelper =
    "typeName" in schema._def
      ? depictHelpers[schema._def.typeName as keyof typeof depictHelpers]
      : null;
  if (!nextHelper) {
    throw new OpenAPIError(
      `Zod type ${schema.constructor.name} is unsupported`
    );
  }
  return nextHelper({ schema, initial, isResponse });
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
    ? depicted.allOf.map((entry) =>
        excludeParamsFromDepiction(entry, pathParams)
      )
    : undefined;
  const oneOf = depicted.oneOf
    ? depicted.oneOf.map((entry) =>
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
    depictSchema({
      schema,
      isResponse: true,
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

const depictBasicSecurity: SecurityHelper<"basic"> = ({}) => ({
  type: "http",
  scheme: "basic",
});
const depictBearerSecurity: SecurityHelper<"bearer"> = ({
  format: bearerFormat,
}) => ({
  type: "http",
  scheme: "bearer",
  ...(bearerFormat ? { bearerFormat } : {}),
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
// @todo implement scopes
const depictOpenIdSecurity: SecurityHelper<"openid"> = ({
  url: openIdConnectUrl,
}) => ({
  type: "openIdConnect",
  openIdConnectUrl,
});
// @todo implement scopes
const depictOAuth2Security: SecurityHelper<"oauth2"> = ({}) => ({
  type: "oauth2",
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

export const depictSecurityNames = (
  container: LogicalContainer<string>
): SecurityRequirementObject[] => {
  if (typeof container === "object") {
    if ("or" in container) {
      return container.or.map((entry) =>
        (typeof entry === "string"
          ? [entry]
          : entry.and
        ).reduce<SecurityRequirementObject>(
          (agg, name) => ({
            ...agg,
            [name]: [],
          }),
          {}
        )
      );
    }
    if ("and" in container) {
      return depictSecurityNames(andToOr(container));
    }
  }
  return depictSecurityNames({ or: [container] });
};

export const depictRequest = ({
  method,
  path,
  endpoint,
}: ReqResDepictHelperCommonProps): RequestBodyObject => {
  const pathParams = getRoutePathParams(path);
  const bodyDepiction = excludeExampleFromDepiction(
    excludeParamsFromDepiction(
      depictSchema({
        schema: endpoint.getInputSchema(),
        isResponse: false,
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
