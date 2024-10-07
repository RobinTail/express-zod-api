import assert from "node:assert/strict";
import {
  ExamplesObject,
  MediaTypeObject,
  OAuthFlowObject,
  ParameterLocation,
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
} from "openapi3-ts/oas31";
import {
  concat,
  type as detectType,
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
  toLower,
  union,
  when,
  xprod,
  zip,
} from "ramda";
import { z } from "zod";
import { ResponseVariant } from "./api-response";
import {
  FlatObject,
  combinations,
  getExamples,
  hasCoercion,
  isCustomHeader,
  makeCleanId,
  tryToTransform,
  ucFirst,
} from "./common-helpers";
import { InputSource, TagsConfig } from "./config-type";
import { DateInSchema, ezDateInBrand } from "./date-in-schema";
import { DateOutSchema, ezDateOutBrand } from "./date-out-schema";
import { DocumentationError } from "./errors";
import { FileSchema, ezFileBrand } from "./file-schema";
import { IOSchema } from "./io-schema";
import {
  LogicalContainer,
  andToOr,
  mapLogicalContainer,
} from "./logical-container";
import { metaSymbol } from "./metadata";
import { Method } from "./method";
import { ProprietaryBrand } from "./proprietary-schemas";
import { RawSchema, ezRawBrand } from "./raw-schema";
import { HandlingRules, SchemaHandler, walkSchema } from "./schema-walker";
import { Security } from "./security";
import { UploadSchema, ezUploadBrand } from "./upload-schema";

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

export type Depicter = SchemaHandler<
  SchemaObject | ReferenceObject,
  OpenAPIContext
>;

interface ReqResHandlingProps<S extends z.ZodTypeAny>
  extends Pick<
    OpenAPIContext,
    "serializer" | "getRef" | "makeRef" | "path" | "method"
  > {
  schema: S;
  composition: "inline" | "components";
  description?: string;
  brandHandling?: HandlingRules<SchemaObject | ReferenceObject, OpenAPIContext>;
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

export const getRoutePathParams = (path: string): string[] =>
  path.match(routePathParamsRegex)?.map((param) => param.slice(1)) || [];

export const reformatParamsInPath = (path: string) =>
  path.replace(routePathParamsRegex, (param) => `{${param.slice(1)}}`);

export const depictDefault: Depicter = (
  { _def }: z.ZodDefault<z.ZodTypeAny>,
  { next },
) => ({
  ...next(_def.innerType),
  default: _def[metaSymbol]?.defaultLabel || _def.defaultValue(),
});

export const depictCatch: Depicter = (
  { _def: { innerType } }: z.ZodCatch<z.ZodTypeAny>,
  { next },
) => next(innerType);

export const depictAny: Depicter = () => ({ format: "any" });

export const depictUpload: Depicter = ({}: UploadSchema, ctx) => {
  assert(
    !ctx.isResponse,
    new DocumentationError({
      message: "Please use ez.upload() only for input.",
      ...ctx,
    }),
  );
  return { type: "string", format: "binary" };
};

export const depictFile: Depicter = (schema: FileSchema) => {
  const subject = schema.unwrap();
  return {
    type: "string",
    format:
      subject instanceof z.ZodString
        ? subject._def.checks.find((check) => check.kind === "base64")
          ? "byte"
          : "file"
        : "binary",
  };
};

export const depictUnion: Depicter = (
  { options }: z.ZodUnion<z.ZodUnionOptions>,
  { next },
) => ({ oneOf: options.map(next) });

export const depictDiscriminatedUnion: Depicter = (
  {
    options,
    discriminator,
  }: z.ZodDiscriminatedUnion<string, z.ZodDiscriminatedUnionOption<string>[]>,
  { next },
) => {
  return {
    discriminator: { propertyName: discriminator },
    oneOf: options.map(next),
  };
};

/** @throws AssertionError */
const tryFlattenIntersection = (
  children: Array<SchemaObject | ReferenceObject>,
) => {
  const [left, right] = children
    .filter(isSchemaObject)
    .filter(
      (entry) =>
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

export const depictIntersection: Depicter = (
  { _def: { left, right } }: z.ZodIntersection<z.ZodTypeAny, z.ZodTypeAny>,
  { next },
) => {
  const children = [left, right].map(next);
  try {
    return tryFlattenIntersection(children);
  } catch {}
  return { allOf: children };
};

export const depictOptional: Depicter = (
  schema: z.ZodOptional<z.ZodTypeAny>,
  { next },
) => next(schema.unwrap());

export const depictReadonly: Depicter = (
  schema: z.ZodReadonly<z.ZodTypeAny>,
  { next },
) => next(schema.unwrap());

/** @since OAS 3.1 nullable replaced with type array having null */
export const depictNullable: Depicter = (
  schema: z.ZodNullable<z.ZodTypeAny>,
  { next },
) => {
  const nested = next(schema.unwrap());
  if (isSchemaObject(nested)) {
    nested.type = makeNullableType(nested);
  }
  return nested;
};

const getSupportedType = (value: unknown): SchemaObjectType | undefined => {
  const detected = toLower(detectType(value)); // toLower is typed well unlike .toLowerCase()
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

export const depictEnum: Depicter = (
  schema: z.ZodEnum<[string, ...string[]]> | z.ZodNativeEnum<z.EnumLike>,
) => ({
  type: getSupportedType(Object.values(schema.enum)[0]),
  enum: Object.values(schema.enum),
});

export const depictLiteral: Depicter = ({ value }: z.ZodLiteral<unknown>) => ({
  type: getSupportedType(value), // constructor allows z.Primitive only, but ZodLiteral does not have that constraint
  const: value,
});

export const depictObject: Depicter = (
  schema: z.ZodObject<z.ZodRawShape>,
  { isResponse, next },
) => {
  const keys = Object.keys(schema.shape);
  const isOptionalProp = (prop: z.ZodTypeAny) =>
    isResponse && hasCoercion(prop)
      ? prop instanceof z.ZodOptional
      : prop.isOptional();
  const required = keys.filter((key) => !isOptionalProp(schema.shape[key]));
  const result: SchemaObject = { type: "object" };
  if (keys.length) {
    result.properties = depictObjectProperties(schema, next);
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
export const depictNull: Depicter = () => ({ type: "null" });

export const depictDateIn: Depicter = ({}: DateInSchema, ctx) => {
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
    pattern: /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?)?Z?$/.source,
    externalDocs: {
      url: isoDateDocumentationUrl,
    },
  };
};

export const depictDateOut: Depicter = ({}: DateOutSchema, ctx) => {
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
export const depictDate: Depicter = ({}: z.ZodDate, ctx) =>
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

export const depictBoolean: Depicter = () => ({ type: "boolean" });

export const depictBigInt: Depicter = () => ({
  type: "integer",
  format: "bigint",
});

const areOptionsLiteral = (
  subject: z.ZodTypeAny[],
): subject is z.ZodLiteral<unknown>[] =>
  subject.every((option) => option instanceof z.ZodLiteral);

export const depictRecord: Depicter = (
  { keySchema, valueSchema }: z.ZodRecord<z.ZodTypeAny>,
  { next },
) => {
  if (keySchema instanceof z.ZodEnum || keySchema instanceof z.ZodNativeEnum) {
    const keys = Object.values(keySchema.enum) as string[];
    const result: SchemaObject = { type: "object" };
    if (keys.length) {
      result.properties = depictObjectProperties(
        z.object(fromPairs(xprod(keys, [valueSchema]))),
        next,
      );
      result.required = keys;
    }
    return result;
  }
  if (keySchema instanceof z.ZodLiteral) {
    return {
      type: "object",
      properties: depictObjectProperties(
        z.object({ [keySchema.value]: valueSchema }),
        next,
      ),
      required: [keySchema.value],
    };
  }
  if (keySchema instanceof z.ZodUnion && areOptionsLiteral(keySchema.options)) {
    const required = map((opt) => `${opt.value}`, keySchema.options);
    const shape = fromPairs(xprod(required, [valueSchema]));
    return {
      type: "object",
      properties: depictObjectProperties(z.object(shape), next),
      required,
    };
  }
  return { type: "object", additionalProperties: next(valueSchema) };
};

export const depictArray: Depicter = (
  { _def: { minLength, maxLength }, element }: z.ZodArray<z.ZodTypeAny>,
  { next },
) => {
  const result: SchemaObject = { type: "array", items: next(element) };
  if (minLength) {
    result.minItems = minLength.value;
  }
  if (maxLength) {
    result.maxItems = maxLength.value;
  }
  return result;
};

/**
 * @since OAS 3.1 using prefixItems for depicting tuples
 * @since 17.5.0 added rest handling, fixed tuple type
 * */
export const depictTuple: Depicter = (
  { items, _def: { rest } }: z.AnyZodTuple,
  { next },
) => ({
  type: "array",
  prefixItems: items.map(next),
  // does not appear to support items:false, so not:{} is a recommended alias
  items: rest === null ? { not: {} } : next(rest),
});

export const depictString: Depicter = ({
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
}: z.ZodString) => {
  const regexCheck = checks.find((check) => check.kind === "regex");
  const datetimeCheck = checks.find((check) => check.kind === "datetime");
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
export const depictNumber: Depicter = ({
  isInt,
  maxValue,
  minValue,
  _def: { checks },
}: z.ZodNumber) => {
  const minCheck = checks.find((check) => check.kind === "min");
  const minimum =
    minValue === null
      ? isInt
        ? Number.MIN_SAFE_INTEGER
        : -Number.MAX_VALUE
      : minValue;
  const isMinInclusive = minCheck ? minCheck.inclusive : true;
  const maxCheck = checks.find((check) => check.kind === "max");
  const maximum =
    maxValue === null
      ? isInt
        ? Number.MAX_SAFE_INTEGER
        : Number.MAX_VALUE
      : maxValue;
  const isMaxInclusive = maxCheck ? maxCheck.inclusive : true;
  const result: SchemaObject = {
    type: isInt ? "integer" : "number",
    format: isInt ? "int64" : "double",
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

export const depictObjectProperties = (
  { shape }: z.ZodObject<z.ZodRawShape>,
  next: Parameters<Depicter>[1]["next"],
) => map(next, shape);

const makeSample = (depicted: SchemaObject) => {
  const firstType = (
    Array.isArray(depicted.type) ? depicted.type[0] : depicted.type
  ) as keyof typeof samples;
  return samples?.[firstType];
};

const makeNullableType = (prev: SchemaObject): SchemaObjectType[] => {
  const current = typeof prev.type === "string" ? [prev.type] : prev.type || [];
  if (current.includes("null")) {
    return current;
  }
  return current.concat("null");
};

export const depictEffect: Depicter = (
  schema: z.ZodEffects<z.ZodTypeAny>,
  { isResponse, next },
) => {
  const input = next(schema.innerType());
  const { effect } = schema._def;
  if (isResponse && effect.type === "transform" && isSchemaObject(input)) {
    const outputType = tryToTransform(schema, makeSample(input));
    if (outputType && ["number", "string", "boolean"].includes(outputType)) {
      return { type: outputType as "number" | "string" | "boolean" };
    } else {
      return next(z.any());
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

export const depictPipeline: Depicter = (
  { _def }: z.ZodPipeline<z.ZodTypeAny, z.ZodTypeAny>,
  { isResponse, next },
) => next(_def[isResponse ? "out" : "in"]);

export const depictBranded: Depicter = (
  schema: z.ZodBranded<z.ZodTypeAny, string | number | symbol>,
  { next },
) => next(schema.unwrap());

export const depictLazy: Depicter = (
  { schema }: z.ZodLazy<z.ZodTypeAny>,
  { next, serializer: serialize, getRef, makeRef },
): ReferenceObject => {
  const hash = serialize(schema);
  return (
    getRef(hash) ||
    (() => {
      makeRef(hash, {}); // make empty ref first
      return makeRef(hash, next(schema)); // update
    })()
  );
};

export const depictRaw: Depicter = (schema: RawSchema, { next }) =>
  next(schema.unwrap().shape.raw);

const enumerateExamples = (examples: unknown[]): ExamplesObject | undefined =>
  examples.length
    ? fromPairs(
        zip(
          range(1, examples.length + 1).map((idx) => `example${idx}`),
          map(objOf("value"), examples),
        ),
      )
    : undefined;

export const depictExamples = (
  schema: z.ZodTypeAny,
  isResponse: boolean,
  omitProps: string[] = [],
): ExamplesObject | undefined =>
  pipe(
    getExamples,
    map(when((subj) => detectType(subj) === "Object", omit(omitProps))),
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
): z.ZodObject<z.ZodRawShape> => {
  if (subject instanceof z.ZodObject) {
    return subject;
  }
  if (subject instanceof z.ZodBranded) {
    return extractObjectSchema(subject.unwrap());
  }
  if (
    subject instanceof z.ZodUnion ||
    subject instanceof z.ZodDiscriminatedUnion
  ) {
    return subject.options
      .map((option) => extractObjectSchema(option))
      .reduce((acc, option) => acc.merge(option.partial()), z.object({}));
  } else if (subject instanceof z.ZodEffects) {
    return extractObjectSchema(subject._def.schema);
  } else if (subject instanceof z.ZodPipeline) {
    return extractObjectSchema(subject._def.in);
  } // intersection left:
  return extractObjectSchema(subject._def.left).merge(
    extractObjectSchema(subject._def.right),
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
  brandHandling,
  description = `${method.toUpperCase()} ${path} Parameter`,
}: ReqResHandlingProps<IOSchema> & {
  inputSources: InputSource[];
}) => {
  const { shape } = extractObjectSchema(schema);
  const pathParams = getRoutePathParams(path);
  const isQueryEnabled = inputSources.includes("query");
  const areParamsEnabled = inputSources.includes("params");
  const areHeadersEnabled = inputSources.includes("headers");
  const isPathParam = (name: string) =>
    areParamsEnabled && pathParams.includes(name);
  const isHeaderParam = (name: string) =>
    areHeadersEnabled && isCustomHeader(name);

  const parameters = Object.keys(shape)
    .map<{ name: string; location?: ParameterLocation }>((name) => ({
      name,
      location: isPathParam(name)
        ? "path"
        : isHeaderParam(name)
          ? "header"
          : isQueryEnabled
            ? "query"
            : undefined,
    }))
    .filter(
      (parameter): parameter is Required<typeof parameter> =>
        parameter.location !== undefined,
    );

  return parameters.map<ParameterObject>(({ name, location }) => {
    const depicted = walkSchema(shape[name], {
      rules: { ...brandHandling, ...depicters },
      onEach,
      onMissing,
      ctx: {
        isResponse: false,
        serializer,
        getRef,
        makeRef,
        path,
        method,
      },
    });
    const result =
      composition === "components"
        ? makeRef(makeCleanId(description, name), depicted)
        : depicted;
    return {
      name,
      in: location,
      required: !shape[name].isOptional(),
      description: depicted.description || description,
      schema: result,
      examples: depictParamExamples(schema, name),
    };
  });
};

export const depicters: HandlingRules<
  SchemaObject | ReferenceObject,
  OpenAPIContext,
  z.ZodFirstPartyTypeKind | ProprietaryBrand
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
  [ezFileBrand]: depictFile,
  [ezUploadBrand]: depictUpload,
  [ezDateOutBrand]: depictDateOut,
  [ezDateInBrand]: depictDateIn,
  [ezRawBrand]: depictRaw,
};

export const onEach: SchemaHandler<
  SchemaObject | ReferenceObject,
  OpenAPIContext,
  "each"
> = (schema: z.ZodTypeAny, { isResponse, prev }) => {
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
    result.examples = examples.slice();
  }
  return result;
};

export const onMissing: SchemaHandler<
  SchemaObject | ReferenceObject,
  OpenAPIContext,
  "last"
> = (schema: z.ZodTypeAny, ctx) =>
  assert.fail(
    new DocumentationError({
      message: `Zod type ${schema.constructor.name} is unsupported.`,
      ...ctx,
    }),
  );

export const excludeParamsFromDepiction = (
  depicted: SchemaObject | ReferenceObject,
  names: string[],
): SchemaObject | ReferenceObject => {
  if (isReferenceObject(depicted)) {
    return depicted;
  }
  const copy = { ...depicted };
  if (copy.properties) {
    copy.properties = omit(names, copy.properties);
  }
  if (copy.examples) {
    copy.examples = copy.examples.map((entry) => omit(names, entry));
  }
  if (copy.required) {
    copy.required = copy.required.filter((name) => !names.includes(name));
  }
  if (copy.allOf) {
    copy.allOf = copy.allOf.map((entry) =>
      excludeParamsFromDepiction(entry, names),
    );
  }
  if (copy.oneOf) {
    copy.oneOf = copy.oneOf.map((entry) =>
      excludeParamsFromDepiction(entry, names),
    );
  }
  return copy;
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
  brandHandling,
  description = `${method.toUpperCase()} ${path} ${ucFirst(variant)} response ${
    hasMultipleStatusCodes ? statusCode : ""
  }`.trim(),
}: ReqResHandlingProps<z.ZodTypeAny> & {
  mimeTypes: ReadonlyArray<string>;
  variant: ResponseVariant;
  statusCode: number;
  hasMultipleStatusCodes: boolean;
}): ResponseObject => {
  const depictedSchema = excludeExamplesFromDepiction(
    walkSchema(schema, {
      rules: { ...brandHandling, ...depicters },
      onEach,
      onMissing,
      ctx: {
        isResponse: true,
        serializer,
        getRef,
        makeRef,
        path,
        method,
      },
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
  security: Extract<Security, { type: K }>,
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

export const depictBody = ({
  method,
  path,
  schema,
  mimeTypes,
  serializer,
  getRef,
  makeRef,
  composition,
  brandHandling,
  paramNames,
  description = `${method.toUpperCase()} ${path} Request body`,
}: ReqResHandlingProps<IOSchema> & {
  mimeTypes: ReadonlyArray<string>;
  paramNames: string[];
}): RequestBodyObject => {
  const bodyDepiction = excludeExamplesFromDepiction(
    excludeParamsFromDepiction(
      walkSchema(schema, {
        rules: { ...brandHandling, ...depicters },
        onEach,
        onMissing,
        ctx: {
          isResponse: false,
          serializer,
          getRef,
          makeRef,
          path,
          method,
        },
      }),
      paramNames,
    ),
  );
  const media: MediaTypeObject = {
    schema:
      composition === "components"
        ? makeRef(makeCleanId(description), bodyDepiction)
        : bodyDepiction,
    examples: depictExamples(schema, false, paramNames),
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

export const ensureShortDescription = (description: string) =>
  description.length <= shortDescriptionLimit
    ? description
    : description.slice(0, shortDescriptionLimit - 1) + "…";
