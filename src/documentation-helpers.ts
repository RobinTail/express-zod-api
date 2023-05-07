import {
  ContentObject,
  ExampleObject,
  ExamplesObject,
  MediaTypeObject,
  OASVersion,
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
  assertVersion,
  isReferenceObject,
  isSchemaObject,
  isSchemaObject31,
} from "./oas-domain";
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

export interface OpenAPIContext<V extends OASVersion = OASVersion> {
  version: V;
  isResponse: boolean;
  serializer: (schema: z.ZodTypeAny) => string;
  getRef: (name: string) => ReferenceObject<V> | undefined;
  makeRef: (
    name: string,
    schema: SchemaObject<V> | ReferenceObject<V>
  ) => ReferenceObject<V>;
  path: string;
  method: Method;
}

type Depicter<
  T extends z.ZodTypeAny,
  V extends OASVersion = OASVersion,
  Variant extends HandlingVariant = "regular"
> = SchemaHandler<
  T,
  SchemaObject<V> | ReferenceObject<V>,
  OpenAPIContext<V>,
  Variant
>;

interface ReqResDepictHelperCommonProps
  extends Pick<
    OpenAPIContext<OASVersion>,
    "serializer" | "getRef" | "makeRef" | "path" | "method" | "version"
  > {
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

export const depictUpload: Depicter<ZodUpload> = (ctx) => {
  if (ctx.isResponse) {
    throw new OpenAPIError({
      message: "Please use z.upload() only for input.",
      ...ctx,
    });
  }
  return {
    type: "string",
    format: "binary",
  };
};

export const depictFile: Depicter<ZodFile> = ({
  schema: { isBinary, isBase64 },
  ...ctx
}) => {
  if (!ctx.isResponse) {
    throw new OpenAPIError({
      message: "Please use z.file() only within ResultHandler.",
      ...ctx,
    });
  }
  return {
    type: "string",
    format: isBinary ? "binary" : isBase64 ? "byte" : "file",
  };
};

export const depictUnion: Depicter<
  z.ZodUnion<[z.ZodTypeAny, ...z.ZodTypeAny[]]>
> = ({ version, schema: { options }, next }) =>
  version === "3.1"
    ? ({
        oneOf: options.map((option) =>
          assertVersion(version, next({ schema: option }))
        ),
      } satisfies SchemaObject<typeof version>)
    : ({
        oneOf: options.map((option) =>
          assertVersion(version, next({ schema: option }))
        ),
      } satisfies SchemaObject<typeof version>);

export const depictDiscriminatedUnion: Depicter<
  z.ZodDiscriminatedUnion<string, z.ZodObject<any>[]>
> = ({ version, schema: { options, discriminator }, next }) => {
  const commons = { discriminator: { propertyName: discriminator } };
  const subject = Array.from(options.values());

  return version === "3.1"
    ? ({
        ...commons,
        oneOf: subject.map((option) =>
          assertVersion(version, next({ schema: option }))
        ),
      } satisfies SchemaObject<typeof version>)
    : ({
        ...commons,
        oneOf: subject.map((option) =>
          assertVersion(version, next({ schema: option }))
        ),
      } satisfies SchemaObject<typeof version>);
};

export const depictIntersection: Depicter<
  z.ZodIntersection<z.ZodTypeAny, z.ZodTypeAny>
> = ({
  version,
  schema: {
    _def: { left, right },
  },
  next,
}) => {
  const subject = [left, right];
  return version === "3.1"
    ? ({
        allOf: subject.map((entry) =>
          assertVersion(version, next({ schema: entry }))
        ),
      } satisfies SchemaObject<typeof version>)
    : ({
        allOf: subject.map((entry) =>
          assertVersion(version, next({ schema: entry }))
        ),
      } satisfies SchemaObject<typeof version>);
};

export const depictOptional: Depicter<z.ZodOptional<any>> = ({
  version,
  schema,
  next,
}) => assertVersion(version, next({ schema: schema.unwrap() }));

export const depictNullable: Depicter<z.ZodNullable<any>> = ({
  version,
  schema,
  next,
}) => {
  const commons = next({ schema: schema.unwrap() });
  if (version === "3.1") {
    const depictedTypes =
      isSchemaObject31(commons) && commons.type
        ? Array.isArray(commons.type)
          ? commons.type
          : [commons.type]
        : [];
    return {
      ...assertVersion(version, commons),
      type: depictedTypes.concat("null"),
    } satisfies SchemaObject<typeof version>;
  }
  return {
    nullable: true,
    ...assertVersion(version, commons),
  } satisfies SchemaObject<typeof version>;
};

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
  version,
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
  const commons = {
    type: "object" as const,
    ...(required.length ? { required } : {}),
  };

  return version === "3.1"
    ? ({
        ...commons,
        properties: depictObjectProperties({
          version,
          schema,
          isResponse,
          ...rest,
        }),
      } satisfies SchemaObject<typeof version>)
    : ({
        ...commons,
        properties: depictObjectProperties({
          version,
          schema,
          isResponse,
          ...rest,
        }),
      } satisfies SchemaObject<typeof version>);
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

export const depictDateIn: Depicter<ZodDateIn> = (ctx) => {
  if (ctx.isResponse) {
    throw new OpenAPIError({
      message: "Please use z.dateOut() for output.",
      ...ctx,
    });
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

export const depictDateOut: Depicter<ZodDateOut> = (ctx) => {
  if (!ctx.isResponse) {
    throw new OpenAPIError({
      message: "Please use z.dateIn() for input.",
      ...ctx,
    });
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
export const depictDate: Depicter<z.ZodDate> = (ctx) => {
  throw new OpenAPIError({
    message: `Using z.date() within ${
      ctx.isResponse ? "output" : "input"
    } schema is forbidden. Please use z.date${
      ctx.isResponse ? "Out" : "In"
    }() instead. Check out the documentation for details.`,
    ...ctx,
  });
};

export const depictBoolean: Depicter<z.ZodBoolean> = () => ({
  type: "boolean",
});

export const depictBigInt: Depicter<z.ZodBigInt> = () => ({
  type: "integer",
  format: "bigint",
});

export const depictRecord: Depicter<z.ZodRecord<z.ZodTypeAny>> = ({
  version,
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
    const commons = {
      type: "object" as const,
      ...(keys.length ? { required: keys } : {}),
    };
    return version === "3.1"
      ? ({
          ...commons,
          properties: depictObjectProperties({
            version,
            schema: z.object(shape),
            ...rest,
          }),
        } satisfies SchemaObject<typeof version>)
      : ({
          ...commons,
          properties: depictObjectProperties({
            version,
            schema: z.object(shape),
            ...rest,
          }),
        } satisfies SchemaObject<typeof version>);
  }
  if (keySchema instanceof z.ZodLiteral) {
    const commons = {
      type: "object" as const,
      required: [keySchema.value],
    };
    return version === "3.1"
      ? ({
          ...commons,
          properties: depictObjectProperties({
            version,
            schema: z.object({
              [keySchema.value]: valueSchema,
            }),
            ...rest,
          }),
        } satisfies SchemaObject<typeof version>)
      : ({
          ...commons,
          properties: depictObjectProperties({
            version,
            schema: z.object({
              [keySchema.value]: valueSchema,
            }),
            ...rest,
          }),
        } satisfies SchemaObject<typeof version>);
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
      const commons = {
        type: "object" as const,
        required: keySchema.options.map(
          (option: z.ZodLiteral<any>) => option.value
        ),
      };
      return version === "3.1"
        ? ({
            ...commons,
            properties: depictObjectProperties({
              version,
              schema: z.object(shape),
              ...rest,
            }),
          } satisfies SchemaObject<typeof version>)
        : ({
            ...commons,
            properties: depictObjectProperties({
              version,
              schema: z.object(shape),
              ...rest,
            }),
          } satisfies SchemaObject<typeof version>);
    }
  }
  const commons = { type: "object" as const };
  return version === "3.1"
    ? ({
        ...commons,
        additionalProperties: assertVersion(
          version,
          rest.next({ schema: valueSchema })
        ),
      } satisfies SchemaObject<typeof version>)
    : ({
        ...commons,
        additionalProperties: assertVersion(
          version,
          rest.next({ schema: valueSchema })
        ),
      } satisfies SchemaObject<typeof version>);
};

export const depictArray: Depicter<z.ZodArray<z.ZodTypeAny>> = ({
  version,
  schema: { _def: def, element },
  next,
}) => {
  const commons = {
    type: "array" as const,
    ...(def.minLength !== null && { minItems: def.minLength.value }),
    ...(def.maxLength !== null && { maxItems: def.maxLength.value }),
  };

  return version === "3.1"
    ? ({
        ...commons,
        items: assertVersion(version, next({ schema: element })),
      } satisfies SchemaObject<typeof version>)
    : ({
        ...commons,
        items: assertVersion(version, next({ schema: element })),
      } satisfies SchemaObject<typeof version>);
};

export const depictTuple: Depicter<z.ZodTuple> = ({
  version,
  schema: { items },
  next,
}) => {
  const types = items.map((item) => next({ schema: item }));
  const commons = {
    type: "array" as const,
    minItems: types.length,
    maxItems: types.length,
  };
  return version === "3.1"
    ? ({
        ...commons,
        prefixItems: types.map((item) => assertVersion(version, item)),
      } satisfies SchemaObject<typeof version>)
    : ({
        ...commons,
        items: {
          oneOf: types.map((item) => assertVersion(version, item)),
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
      } satisfies SchemaObject<typeof version>);
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

export const depictNumber: Depicter<z.ZodNumber> = ({ version, schema }) => {
  const minCheck = schema._def.checks.find(({ kind }) => kind === "min") as
    | Extract<z.ZodNumberCheck, { kind: "min" }>
    | undefined;
  const isMinInclusive = minCheck ? minCheck.inclusive : true;
  const minimum =
    schema.minValue === null
      ? schema.isInt
        ? Number.MIN_SAFE_INTEGER
        : Number.MIN_VALUE
      : schema.minValue;
  const maxCheck = schema._def.checks.find(({ kind }) => kind === "max") as
    | Extract<z.ZodNumberCheck, { kind: "max" }>
    | undefined;
  const isMaxInclusive = maxCheck ? maxCheck.inclusive : true;
  const maximum =
    schema.maxValue === null
      ? schema.isInt
        ? Number.MAX_SAFE_INTEGER
        : Number.MAX_VALUE
      : schema.maxValue;
  return version === "3.1"
    ? ({
        type: schema.isInt ? ("integer" as const) : ("number" as const),
        format: schema.isInt ? ("int64" as const) : ("double" as const),
        ...(isMinInclusive ? { minimum } : { exclusiveMinimum: minimum }),
        ...(isMinInclusive ? { maximum } : { exclusiveMaximum: maximum }),
      } satisfies SchemaObject<typeof version>)
    : ({
        type: schema.isInt ? ("integer" as const) : ("number" as const),
        format: schema.isInt ? ("int64" as const) : ("double" as const),
        minimum,
        exclusiveMinimum: !isMinInclusive,
        maximum,
        exclusiveMaximum: !isMaxInclusive,
      } satisfies SchemaObject<typeof version>);
};

export const depictObjectProperties = <V extends OASVersion>({
  version,
  schema: { shape },
  next,
}: Parameters<Depicter<z.AnyZodObject>>[0] & { version: V }) =>
  Object.keys(shape).reduce(
    (carry, key) => ({
      ...carry,
      [key]: assertVersion(version, next({ schema: shape[key] })),
    }),
    {} as Record<string, SchemaObject<V> | ReferenceObject<V>>
  );

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

export const depictLazy: Depicter<z.ZodLazy<z.ZodTypeAny>> = ({
  next,
  schema: lazy,
  serializer: serialize,
  getRef,
  makeRef,
}): ReferenceObject => {
  const hash = serialize(lazy.schema);
  return (
    getRef(hash) ||
    (() => {
      makeRef(hash, {}); // make empty ref first
      return makeRef(hash, next({ schema: lazy.schema })); // update
    })()
  );
};

export const depictExamples = (
  schema: z.ZodTypeAny,
  isResponse: boolean,
  omitProps: string[] = []
): Pick<MediaTypeObject, "examples"> => {
  const examples = getExamples(schema, isResponse);
  if (examples.length === 0) {
    return {};
  }
  return {
    examples: examples.reduce<ExamplesObject>(
      (carry, example, index) => ({
        ...carry,
        [`example${index + 1}`]: {
          value: omit(omitProps, example),
        } satisfies ExampleObject,
      }),
      {}
    ),
  };
};

export const depictParamExamples = (
  schema: z.ZodTypeAny,
  isResponse: boolean,
  param: string
): MediaTypeObject => {
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
              [`example${index + 1}`]: {
                value: example[param],
              } satisfies ExampleObject,
            }
          : carry,
      {}
    ),
  } satisfies MediaTypeObject;
};

export function extractObjectSchema(
  subject: IOSchema,
  ctx: Pick<OpenAPIContext, "path" | "method" | "isResponse">
) {
  if (subject instanceof z.ZodObject) {
    return subject;
  }
  let objectSchema: z.AnyZodObject;
  if (
    subject instanceof z.ZodUnion ||
    subject instanceof z.ZodDiscriminatedUnion
  ) {
    objectSchema = Array.from(subject.options.values())
      .map((option) => extractObjectSchema(option, ctx))
      .reduce((acc, option) => acc.merge(option.partial()), z.object({}));
  } else if (subject instanceof z.ZodEffects) {
    if (hasTopLevelTransformingEffect(subject)) {
      throw new OpenAPIError({
        message: `Using transformations on the top level of ${
          ctx.isResponse ? "response" : "input"
        } schema is not allowed.`,
        ...ctx,
      });
    }
    objectSchema = extractObjectSchema(subject._def.schema, ctx); // object refinement
  } else {
    // intersection
    objectSchema = extractObjectSchema(subject._def.left, ctx).merge(
      extractObjectSchema(subject._def.right, ctx)
    );
  }
  return copyMeta(subject, objectSchema);
}

export const depictRequestParams = ({
  version,
  path,
  method,
  endpoint,
  inputSources,
  serializer,
  getRef,
  makeRef,
  composition,
  clue = "parameter",
}: ReqResDepictHelperCommonProps & {
  inputSources: InputSource[];
}): ParameterObject[] => {
  const schema = endpoint.getSchema("input");
  const shape = extractObjectSchema(schema, {
    path,
    method,
    isResponse: false,
  }).shape;
  const pathParams = getRoutePathParams(path);
  const isQueryEnabled = inputSources.includes("query");
  const isParamsEnabled = inputSources.includes("params");
  const isPathParam = (name: string) =>
    isParamsEnabled && pathParams.includes(name);
  const filteredParams = Object.keys(shape).filter(
    (name) => isQueryEnabled || isPathParam(name)
  );

  return filteredParams.map<ParameterObject>((name) => {
    const depicted = walkSchema({
      version,
      schema: shape[name],
      isResponse: false,
      rules: depicters,
      onEach,
      onMissing,
      serializer,
      getRef,
      makeRef,
      path,
      method,
    });
    const commons = {
      name,
      in: isPathParam(name) ? ("path" as const) : ("query" as const),
      required: !shape[name].isOptional(),
      description:
        (isSchemaObject(depicted) && depicted.description) ||
        `${method.toUpperCase()} ${path} ${clue}`,
      ...depictParamExamples(schema, false, name),
    };
    const result =
      composition === "components"
        ? makeRef(makeCleanId(path, method, `${clue} ${name}`), depicted)
        : depicted;
    return version === "3.1"
      ? ({
          ...commons,
          schema: assertVersion(version, result),
        } satisfies ParameterObject<typeof version>)
      : ({
          ...commons,
          schema: assertVersion(version, result),
        } satisfies ParameterObject<typeof version>);
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

export const onEach: Depicter<z.ZodTypeAny, OASVersion, "each"> = ({
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
  } satisfies SchemaObject;
};

export const onMissing: Depicter<z.ZodTypeAny, OASVersion, "last"> = ({
  schema,
  ...ctx
}) => {
  throw new OpenAPIError({
    message: `Zod type ${schema.constructor.name} is unsupported.`,
    ...ctx,
  });
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
  isSchemaObject(depicted)
    ? (omit(["example"], depicted) as SchemaObject)
    : depicted;

export const depictResponse = ({
  version,
  method,
  path,
  endpoint,
  isPositive,
  serializer,
  getRef,
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
      version,
      schema,
      isResponse: true,
      rules: depicters,
      onEach,
      onMissing,
      serializer,
      getRef,
      makeRef,
      path,
      method,
    })
  );
  const examples = depictExamples(schema, true);
  const result =
    composition === "components"
      ? makeRef(makeCleanId(path, method, clue), depictedSchema)
      : depictedSchema;
  const commons = { description: `${method.toUpperCase()} ${path} ${clue}` };

  return version === "3.1"
    ? ({
        ...commons,
        content: mimeTypes.reduce<ContentObject<typeof version>>(
          (carry, mimeType) => ({
            ...carry,
            [mimeType]: {
              schema: assertVersion(version, result),
              ...examples,
            } satisfies MediaTypeObject<typeof version>,
          }),
          {}
        ),
      } satisfies ResponseObject<typeof version>)
    : ({
        ...commons,
        content: mimeTypes.reduce<ContentObject<typeof version>>(
          (carry, mimeType) => ({
            ...carry,
            [mimeType]: {
              schema: assertVersion(version, result),
              ...examples,
            } satisfies MediaTypeObject<typeof version>,
          }),
          {}
        ),
      } satisfies ResponseObject<typeof version>);
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
  version,
  method,
  path,
  endpoint,
  serializer,
  getRef,
  makeRef,
  composition,
  clue = "request body",
}: ReqResDepictHelperCommonProps): RequestBodyObject => {
  const pathParams = getRoutePathParams(path);
  const bodyDepiction = excludeExampleFromDepiction(
    excludeParamsFromDepiction(
      walkSchema({
        version,
        schema: endpoint.getSchema("input"),
        isResponse: false,
        rules: depicters,
        onEach,
        onMissing,
        serializer,
        getRef,
        makeRef,
        path,
        method,
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
  const mimeTypes = endpoint.getMimeTypes("input");
  const commons = {
    description: `${method.toUpperCase()} ${path} ${clue}`,
  };

  return version === "3.1"
    ? ({
        ...commons,
        content: mimeTypes.reduce<ContentObject<typeof version>>(
          (carry, mimeType) => ({
            ...carry,
            [mimeType]: {
              schema: assertVersion(version, result),
              ...bodyExamples,
            } satisfies MediaTypeObject<typeof version>,
          }),
          {}
        ),
      } satisfies RequestBodyObject<typeof version>)
    : ({
        ...commons,
        content: mimeTypes.reduce<ContentObject<typeof version>>(
          (carry, mimeType) => ({
            ...carry,
            [mimeType]: {
              schema: assertVersion(version, result),
              ...bodyExamples,
            } satisfies MediaTypeObject<typeof version>,
          }),
          {}
        ),
      } satisfies RequestBodyObject<typeof version>);
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
