import assert from "node:assert/strict";
import {
  ExamplesObject,
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
  isReferenceObject,
} from "openapi3-ts/oas31";
import {
  concat,
  filter,
  fromPairs,
  has,
  isNil,
  map,
  mergeAll,
  mergeDeepRight,
  mergeDeepWith,
  objOf,
  omit,
  pipe,
  pluck,
  range,
  reject,
  union,
  when,
  xprod,
  zipObj,
} from "ramda";
import { z } from "zod";
import {
  FlatObject,
  combinations,
  getExamples,
  hasCoercion,
  isActualObject,
  isCustomHeader,
  makeCleanId,
  tryToTransform,
  ucFirst,
} from "./common-helpers";
import { InputSource, TagsConfig } from "./config-type";
import { ezDateInKind } from "./date-in-schema";
import { ezDateOutKind } from "./date-out-schema";
import { DocumentationError } from "./errors";
import { ezFileKind } from "./file-schema";
import { IOSchema } from "./io-schema";
import {
  LogicalContainer,
  andToOr,
  mapLogicalContainer,
} from "./logical-container";
import { Method } from "./method";
import { RawSchema, ezRawKind } from "./raw-schema";
import { isoDateRegex } from "./schema-helpers";
import {
  HandlingRules,
  HandlingVariant,
  SchemaHandler,
  walkSchema,
} from "./schema-walker";
import { Security } from "./security";
import { ezUploadKind } from "./upload-schema";

/* eslint-disable @typescript-eslint/no-use-before-define */

export interface OpenAPIContext extends FlatObject {
  isResponse: boolean;
  serializer: (schema: z.ZodTypeAny) => string;
  getRef: (name: string) => ReferenceObject | undefined;
  makeRef: (
    name: string,
    schema: SchemaObject | ReferenceObject,
  ) => ReferenceObject;
  path: string;
  method: Method;
}

type Depicter<
  T extends z.ZodTypeAny,
  Variant extends HandlingVariant = "regular",
> = SchemaHandler<T, SchemaObject | ReferenceObject, OpenAPIContext, Variant>;

interface ReqResDepictHelperCommonProps
  extends Pick<
    OpenAPIContext,
    "serializer" | "getRef" | "makeRef" | "path" | "method"
  > {
  schema: z.ZodTypeAny;
  mimeTypes: string[];
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

/** @see https://expressjs.com/en/guide/routing.html */
const routePathParamsRegex = /:([A-Za-z0-9_]+)/g;

export const getRoutePathParams = (path: string): string[] => {
  const match = path.match(routePathParamsRegex);
  if (!match) {
    return [];
  }
  return match.map((param) => param.slice(1));
};

export const reformatParamsInPath = (path: string) =>
  path.replace(routePathParamsRegex, (param) => `{${param.slice(1)}}`);

export const depictDefault: Depicter<z.ZodDefault<z.ZodTypeAny>> = ({
  schema: {
    _def: { innerType, defaultValue },
  },
  next,
}) => ({ ...next(innerType), default: defaultValue() });

export const depictCatch: Depicter<z.ZodCatch<z.ZodTypeAny>> = ({
  schema: {
    _def: { innerType },
  },
  next,
}) => next(innerType);

export const depictAny: Depicter<z.ZodAny> = () => ({
  format: "any",
});

export const depictUpload: Depicter<z.ZodType> = (ctx) => {
  assert(
    !ctx.isResponse,
    new DocumentationError({
      message: "Please use ez.upload() only for input.",
      ...ctx,
    }),
  );
  return {
    type: "string",
    format: "binary",
  };
};

export const depictFile: Depicter<z.ZodType> = ({ schema }) => ({
  type: "string",
  format:
    schema instanceof z.ZodString
      ? schema._def.checks.find((check) => check.kind === "regex")
        ? "byte"
        : "file"
      : "binary",
});

export const depictUnion: Depicter<z.ZodUnion<z.ZodUnionOptions>> = ({
  schema: { options },
  next,
}) => ({ oneOf: options.map(next) });

export const depictDiscriminatedUnion: Depicter<
  z.ZodDiscriminatedUnion<string, z.ZodDiscriminatedUnionOption<string>[]>
> = ({ schema: { options, discriminator }, next }) => {
  return {
    discriminator: { propertyName: discriminator },
    oneOf: Array.from(options.values()).map(next),
  };
};

/** @throws AssertionError */
const tryFlattenIntersection = (
  children: Array<SchemaObject | ReferenceObject>,
) => {
  const [left, right] = children.filter(
    (entry): entry is SchemaObject =>
      !isReferenceObject(entry) &&
      entry.type === "object" &&
      Object.keys(entry).every((key) =>
        ["type", "properties", "required", "examples"].includes(key),
      ),
  );
  assert(left && right, "Can not flatten objects");
  const flat: SchemaObject = { type: "object" };
  if (left.properties || right.properties) {
    flat.properties = mergeDeepWith(
      (a, b) =>
        Array.isArray(a) && Array.isArray(b)
          ? concat(a, b)
          : a === b
            ? b
            : assert.fail("Can not flatten properties"),
      left.properties || {},
      right.properties || {},
    );
  }
  if (left.required || right.required) {
    flat.required = union(left.required || [], right.required || []);
  }
  if (left.examples || right.examples) {
    flat.examples = combinations(
      left.examples || [],
      right.examples || [],
      ([a, b]) => mergeDeepRight(a, b),
    );
  }
  return flat;
};

export const depictIntersection: Depicter<
  z.ZodIntersection<z.ZodTypeAny, z.ZodTypeAny>
> = ({
  schema: {
    _def: { left, right },
  },
  next,
}) => {
  const children = [left, right].map(next);
  try {
    return tryFlattenIntersection(children);
  } catch {}
  return { allOf: children };
};

export const depictOptional: Depicter<z.ZodOptional<z.ZodTypeAny>> = ({
  schema,
  next,
}) => next(schema.unwrap());

export const depictReadonly: Depicter<z.ZodReadonly<z.ZodTypeAny>> = ({
  schema,
  next,
}) => next(schema._def.innerType);

/** @since OAS 3.1 nullable replaced with type array having null */
export const depictNullable: Depicter<z.ZodNullable<z.ZodTypeAny>> = ({
  schema,
  next,
}) => {
  const nested = next(schema.unwrap());
  if (!isReferenceObject(nested)) {
    nested.type = makeNullableType(nested);
  }
  return nested;
};

export const depictEnum: Depicter<
  z.ZodEnum<[string, ...string[]]> | z.ZodNativeEnum<any> // keeping "any" for ZodNativeEnum as compatibility fix
> = ({ schema }) => ({
  type: typeof Object.values(schema.enum)[0] as "string" | "number",
  enum: Object.values(schema.enum),
});

export const depictLiteral: Depicter<z.ZodLiteral<unknown>> = ({
  schema: { value },
}) => ({
  type: typeof value as "string" | "number" | "boolean",
  enum: [value],
});

export const depictObject: Depicter<z.ZodObject<z.ZodRawShape>> = ({
  schema,
  isResponse,
  ...rest
}) => {
  const keys = Object.keys(schema.shape);
  const isOptionalProp = (prop: z.ZodTypeAny) =>
    isResponse && hasCoercion(prop)
      ? prop instanceof z.ZodOptional
      : prop.isOptional();
  const required = keys.filter((key) => !isOptionalProp(schema.shape[key]));
  const result: SchemaObject = { type: "object" };
  if (keys.length) {
    result.properties = depictObjectProperties({ schema, isResponse, ...rest });
  }
  if (required.length) {
    result.required = required;
  }
  return result;
};

/**
 * @see https://swagger.io/docs/specification/data-models/data-types/
 * @since OAS 3.1: using type: "null"
 * */
export const depictNull: Depicter<z.ZodNull> = () => ({ type: "null" });

export const depictDateIn: Depicter<z.ZodType> = (ctx) => {
  assert(
    !ctx.isResponse,
    new DocumentationError({
      message: "Please use ez.dateOut() for output.",
      ...ctx,
    }),
  );
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

export const depictDateOut: Depicter<z.ZodType> = (ctx) => {
  assert(
    ctx.isResponse,
    new DocumentationError({
      message: "Please use ez.dateIn() for input.",
      ...ctx,
    }),
  );
  return {
    description: "YYYY-MM-DDTHH:mm:ss.sssZ",
    type: "string",
    format: "date-time",
    externalDocs: {
      url: isoDateDocumentationUrl,
    },
  };
};

/** @throws DocumentationError */
export const depictDate: Depicter<z.ZodDate> = (ctx) =>
  assert.fail(
    new DocumentationError({
      message: `Using z.date() within ${
        ctx.isResponse ? "output" : "input"
      } schema is forbidden. Please use ez.date${
        ctx.isResponse ? "Out" : "In"
      }() instead. Check out the documentation for details.`,
      ...ctx,
    }),
  );

export const depictBoolean: Depicter<z.ZodBoolean> = () => ({
  type: "boolean",
});

export const depictBigInt: Depicter<z.ZodBigInt> = () => ({
  type: "integer",
  format: "bigint",
});

const areOptionsLiteral = (
  subject: z.ZodTypeAny[],
): subject is z.ZodLiteral<unknown>[] =>
  subject.every((option) => option instanceof z.ZodLiteral);

export const depictRecord: Depicter<z.ZodRecord<z.ZodTypeAny>> = ({
  schema: { keySchema, valueSchema },
  ...rest
}) => {
  if (keySchema instanceof z.ZodEnum || keySchema instanceof z.ZodNativeEnum) {
    const keys = Object.values(keySchema.enum) as string[];
    const result: SchemaObject = { type: "object" };
    if (keys.length) {
      result.properties = depictObjectProperties({
        schema: z.object(fromPairs(xprod(keys, [valueSchema]))),
        ...rest,
      });
      result.required = keys;
    }
    return result;
  }
  if (keySchema instanceof z.ZodLiteral) {
    return {
      type: "object",
      properties: depictObjectProperties({
        schema: z.object({ [keySchema.value]: valueSchema }),
        ...rest,
      }),
      required: [keySchema.value],
    };
  }
  if (keySchema instanceof z.ZodUnion && areOptionsLiteral(keySchema.options)) {
    const required = map((opt) => `${opt.value}`, keySchema.options);
    const shape = fromPairs(xprod(required, [valueSchema]));
    return {
      type: "object",
      properties: depictObjectProperties({ schema: z.object(shape), ...rest }),
      required,
    };
  }
  return { type: "object", additionalProperties: rest.next(valueSchema) };
};

export const depictArray: Depicter<z.ZodArray<z.ZodTypeAny>> = ({
  schema: { _def: def, element },
  next,
}) => {
  const result: SchemaObject = { type: "array", items: next(element) };
  if (def.minLength) {
    result.minItems = def.minLength.value;
  }
  if (def.maxLength) {
    result.maxItems = def.maxLength.value;
  }
  return result;
};

/** @since OAS 3.1 using prefixItems for depicting tuples */
export const depictTuple: Depicter<z.ZodTuple> = ({
  schema: { items },
  next,
}) => ({ type: "array", prefixItems: items.map(next) });

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
      check.kind === "regex",
  );
  const datetimeCheck = checks.find(
    (check): check is z.ZodStringCheck & { kind: "datetime" } =>
      check.kind === "datetime",
  );
  const regex = regexCheck
    ? regexCheck.regex
    : datetimeCheck
      ? datetimeCheck.offset
        ? new RegExp(
            `^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?(([+-]\\d{2}:\\d{2})|Z)$`,
          )
        : new RegExp(`^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z$`)
      : undefined;
  const result: SchemaObject = { type: "string" };
  const formats: Record<NonNullable<SchemaObject["format"]>, boolean> = {
    "date-time": isDatetime,
    email: isEmail,
    url: isURL,
    uuid: isUUID,
    cuid: isCUID,
    cuid2: isCUID2,
    ulid: isULID,
    ip: isIP,
    emoji: isEmoji,
  };
  for (const format in formats) {
    if (formats[format]) {
      result.format = format;
      break;
    }
  }
  if (minLength !== null) {
    result.minLength = minLength;
  }
  if (maxLength !== null) {
    result.maxLength = maxLength;
  }
  if (regex) {
    result.pattern = regex.source;
  }
  return result;
};

/** @since OAS 3.1: exclusive min/max are numbers */
export const depictNumber: Depicter<z.ZodNumber> = ({ schema }) => {
  const minCheck = schema._def.checks.find(({ kind }) => kind === "min") as
    | Extract<z.ZodNumberCheck, { kind: "min" }>
    | undefined;
  const minimum =
    schema.minValue === null
      ? schema.isInt
        ? Number.MIN_SAFE_INTEGER
        : -Number.MAX_VALUE
      : schema.minValue;
  const isMinInclusive = minCheck ? minCheck.inclusive : true;
  const maxCheck = schema._def.checks.find(({ kind }) => kind === "max") as
    | Extract<z.ZodNumberCheck, { kind: "max" }>
    | undefined;
  const maximum =
    schema.maxValue === null
      ? schema.isInt
        ? Number.MAX_SAFE_INTEGER
        : Number.MAX_VALUE
      : schema.maxValue;
  const isMaxInclusive = maxCheck ? maxCheck.inclusive : true;
  const result: SchemaObject = {
    type: schema.isInt ? "integer" : "number",
    format: schema.isInt ? "int64" : "double",
  };
  if (isMinInclusive) {
    result.minimum = minimum;
  } else {
    result.exclusiveMinimum = minimum;
  }
  if (isMaxInclusive) {
    result.maximum = maximum;
  } else {
    result.exclusiveMaximum = maximum;
  }
  return result;
};

export const depictObjectProperties = ({
  schema: { shape },
  next,
}: Parameters<Depicter<z.ZodObject<z.ZodRawShape>>>[0]) => map(next, shape);

const makeSample = (depicted: SchemaObject) => {
  const type = (
    Array.isArray(depicted.type) ? depicted.type[0] : depicted.type
  ) as keyof typeof samples;
  return samples?.[type];
};

const makeNullableType = (prev: SchemaObject): SchemaObjectType[] => {
  const current = typeof prev.type === "string" ? [prev.type] : prev.type || [];
  if (current.includes("null")) {
    return current;
  }
  return current.concat("null");
};

export const depictEffect: Depicter<z.ZodEffects<z.ZodTypeAny>> = ({
  schema,
  isResponse,
  next,
}) => {
  const input = next(schema.innerType());
  const { effect } = schema._def;
  if (isResponse && effect.type === "transform" && !isReferenceObject(input)) {
    const outputType = tryToTransform(schema, makeSample(input));
    if (outputType && ["number", "string", "boolean"].includes(outputType)) {
      return { type: outputType as "number" | "string" | "boolean" };
    } else {
      return next(z.any());
    }
  }
  if (
    !isResponse &&
    effect.type === "preprocess" &&
    !isReferenceObject(input)
  ) {
    const { type: inputType, ...rest } = input;
    return {
      ...rest,
      format: `${rest.format || inputType} (preprocessed)`,
    };
  }
  return input;
};

export const depictPipeline: Depicter<
  z.ZodPipeline<z.ZodTypeAny, z.ZodTypeAny>
> = ({ schema, isResponse, next }) =>
  next(schema._def[isResponse ? "out" : "in"]);

export const depictBranded: Depicter<
  z.ZodBranded<z.ZodTypeAny, string | number | symbol>
> = ({ schema, next }) => next(schema.unwrap());

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
      return makeRef(hash, next(lazy.schema)); // update
    })()
  );
};

export const depictRaw: Depicter<RawSchema> = ({ next, schema }) =>
  next(schema.shape.raw);

const enumerateExamples = (examples: unknown[]): ExamplesObject | undefined =>
  examples.length
    ? zipObj(
        range(1, examples.length + 1).map((idx) => `example${idx}`),
        map(objOf("value"), examples),
      )
    : undefined;

export const depictExamples = (
  schema: z.ZodTypeAny,
  isResponse: boolean,
  omitProps: string[] = [],
): ExamplesObject | undefined =>
  pipe(
    getExamples,
    map(when(isActualObject, omit(omitProps))),
    enumerateExamples,
  )({ schema, variant: isResponse ? "parsed" : "original", validate: true });

export const depictParamExamples = (
  schema: z.ZodTypeAny,
  param: string,
): ExamplesObject | undefined =>
  pipe(
    getExamples,
    filter<FlatObject>(has(param)),
    pluck(param),
    enumerateExamples,
  )({ schema, variant: "original", validate: true });

export const extractObjectSchema = (
  subject: IOSchema,
  tfError: DocumentationError,
): z.ZodObject<z.ZodRawShape> => {
  if (subject instanceof z.ZodObject) {
    return subject;
  }
  if (
    subject instanceof z.ZodUnion ||
    subject instanceof z.ZodDiscriminatedUnion
  ) {
    return Array.from(subject.options.values())
      .map((option) => extractObjectSchema(option, tfError))
      .reduce((acc, option) => acc.merge(option.partial()), z.object({}));
  } else if (subject instanceof z.ZodEffects) {
    assert(subject._def.effect.type === "refinement", tfError);
    return extractObjectSchema(subject._def.schema, tfError); // object refinement
  } // intersection left
  return extractObjectSchema(subject._def.left, tfError).merge(
    extractObjectSchema(subject._def.right, tfError),
  );
};

export const depictRequestParams = ({
  path,
  method,
  schema,
  inputSources,
  serializer,
  getRef,
  makeRef,
  composition,
  description = `${method.toUpperCase()} ${path} Parameter`,
}: Omit<ReqResDepictHelperCommonProps, "mimeTypes"> & {
  inputSources: InputSource[];
}): ParameterObject[] => {
  const { shape } = extractObjectSchema(
    schema,
    new DocumentationError({
      message: `Using transformations on the top level schema is not allowed.`,
      path,
      method,
      isResponse: false,
    }),
  );
  const pathParams = getRoutePathParams(path);
  const isQueryEnabled = inputSources.includes("query");
  const areParamsEnabled = inputSources.includes("params");
  const areHeadersEnabled = inputSources.includes("headers");
  const isPathParam = (name: string) =>
    areParamsEnabled && pathParams.includes(name);
  const isHeaderParam = (name: string) =>
    areHeadersEnabled && isCustomHeader(name);
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
        getRef,
        makeRef,
        path,
        method,
      });
      const result =
        composition === "components"
          ? makeRef(makeCleanId(description, name), depicted)
          : depicted;
      return {
        name,
        in: isPathParam(name)
          ? "path"
          : isHeaderParam(name)
            ? "header"
            : "query",
        required: !shape[name].isOptional(),
        description: depicted.description || description,
        schema: result,
        examples: depictParamExamples(schema, name),
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
  ZodNull: depictNull,
  ZodArray: depictArray,
  ZodTuple: depictTuple,
  ZodRecord: depictRecord,
  ZodObject: depictObject,
  ZodLiteral: depictLiteral,
  ZodIntersection: depictIntersection,
  ZodUnion: depictUnion,
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
  ZodReadonly: depictReadonly,
  [ezFileKind]: depictFile,
  [ezUploadKind]: depictUpload,
  [ezDateOutKind]: depictDateOut,
  [ezDateInKind]: depictDateIn,
  [ezRawKind]: depictRaw,
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
  const examples = shouldAvoidParsing
    ? []
    : getExamples({
        schema,
        variant: isResponse ? "parsed" : "original",
        validate: true,
      });
  const result: SchemaObject = {};
  if (description) {
    result.description = description;
  }
  if (isActuallyNullable) {
    result.type = makeNullableType(prev);
  }
  if (examples.length) {
    result.examples = Array.from(examples);
  }
  return result;
};

export const onMissing: Depicter<z.ZodTypeAny, "last"> = ({ schema, ...ctx }) =>
  assert.fail(
    new DocumentationError({
      message: `Zod type ${schema.constructor.name} is unsupported.`,
      ...ctx,
    }),
  );

export const excludeParamsFromDepiction = (
  depicted: SchemaObject | ReferenceObject,
  pathParams: string[],
): SchemaObject | ReferenceObject => {
  if (isReferenceObject(depicted)) {
    return depicted;
  }
  const properties = depicted.properties
    ? omit(pathParams, depicted.properties)
    : undefined;
  const examples = depicted.examples
    ? depicted.examples.map((entry) => omit(pathParams, entry))
    : undefined;
  const required = depicted.required
    ? depicted.required.filter((name) => !pathParams.includes(name))
    : undefined;
  const allOf = depicted.allOf
    ? (depicted.allOf as SchemaObject[]).map((entry) =>
        excludeParamsFromDepiction(entry, pathParams),
      )
    : undefined;
  const oneOf = depicted.oneOf
    ? (depicted.oneOf as SchemaObject[]).map((entry) =>
        excludeParamsFromDepiction(entry, pathParams),
      )
    : undefined;

  return omit(
    Object.entries({ properties, required, examples, allOf, oneOf })
      .filter(([{}, value]) => value === undefined)
      .map(([key]) => key),
    {
      ...depicted,
      properties,
      required,
      examples,
      allOf,
      oneOf,
    },
  );
};

export const excludeExamplesFromDepiction = (
  depicted: SchemaObject | ReferenceObject,
): SchemaObject | ReferenceObject =>
  isReferenceObject(depicted) ? depicted : omit(["examples"], depicted);

export const depictResponse = ({
  method,
  path,
  schema,
  mimeTypes,
  variant,
  serializer,
  getRef,
  makeRef,
  composition,
  hasMultipleStatusCodes,
  statusCode,
  description = `${method.toUpperCase()} ${path} ${ucFirst(variant)} response ${
    hasMultipleStatusCodes ? statusCode : ""
  }`.trim(),
}: ReqResDepictHelperCommonProps & {
  variant: "positive" | "negative";
  statusCode: number;
  hasMultipleStatusCodes: boolean;
}): ResponseObject => {
  const depictedSchema = excludeExamplesFromDepiction(
    walkSchema({
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
    }),
  );
  const media: MediaTypeObject = {
    schema:
      composition === "components"
        ? makeRef(makeCleanId(description), depictedSchema)
        : depictedSchema,
    examples: depictExamples(schema, true),
  };
  return { description, content: fromPairs(xprod(mimeTypes, [media])) };
};

type SecurityHelper<K extends Security["type"]> = (
  security: Security & { type: K },
  inputSources?: InputSource[],
) => SecuritySchemeObject;

const depictBasicSecurity: SecurityHelper<"basic"> = () => ({
  type: "http",
  scheme: "basic",
});
const depictBearerSecurity: SecurityHelper<"bearer"> = ({
  format: bearerFormat,
}) => {
  const result: SecuritySchemeObject = {
    type: "http",
    scheme: "bearer",
  };
  if (bearerFormat) {
    result.bearerFormat = bearerFormat;
  }
  return result;
};
const depictInputSecurity: SecurityHelper<"input"> = (
  { name },
  inputSources,
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
  flows: map(
    (flow): OAuthFlowObject => ({ ...flow, scopes: flow.scopes || {} }),
    reject(isNil, flows) as Required<typeof flows>,
  ),
});

export const depictSecurity = (
  container: LogicalContainer<Security>,
  inputSources?: InputSource[],
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
    (methods[security.type] as SecurityHelper<typeof security.type>)(
      security,
      inputSources,
    ),
  );
};

export const depictSecurityRefs = (
  container: LogicalContainer<{ name: string; scopes: string[] }>,
): SecurityRequirementObject[] => {
  if ("or" in container) {
    return container.or.map(
      (entry): SecurityRequirementObject =>
        "and" in entry
          ? mergeAll(map(({ name, scopes }) => objOf(name, scopes), entry.and))
          : { [entry.name]: entry.scopes },
    );
  }
  if ("and" in container) {
    return depictSecurityRefs(andToOr(container));
  }
  return depictSecurityRefs({ or: [container] });
};

export const depictRequest = ({
  method,
  path,
  schema,
  mimeTypes,
  serializer,
  getRef,
  makeRef,
  composition,
  description = `${method.toUpperCase()} ${path} Request body`,
}: ReqResDepictHelperCommonProps): RequestBodyObject => {
  const pathParams = getRoutePathParams(path);
  const bodyDepiction = excludeExamplesFromDepiction(
    excludeParamsFromDepiction(
      walkSchema({
        schema,
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
      pathParams,
    ),
  );
  const media: MediaTypeObject = {
    schema:
      composition === "components"
        ? makeRef(makeCleanId(description), bodyDepiction)
        : bodyDepiction,
    examples: depictExamples(schema, false, pathParams),
  };
  return { description, content: fromPairs(xprod(mimeTypes, [media])) };
};

export const depictTags = <TAG extends string>(
  tags: TagsConfig<TAG>,
): TagObject[] =>
  (Object.keys(tags) as TAG[]).map((tag) => {
    const def = tags[tag];
    const result: TagObject = {
      name: tag,
      description: typeof def === "string" ? def : def.description,
    };
    if (typeof def === "object" && def.url) {
      result.externalDocs = { url: def.url };
    }
    return result;
  });

export const ensureShortDescription = (description: string) => {
  if (description.length <= shortDescriptionLimit) {
    return description;
  }
  return description.slice(0, shortDescriptionLimit - 1) + "…";
};
