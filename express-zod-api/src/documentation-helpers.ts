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
  isSchemaObject,
} from "openapi3-ts/oas31";
import * as R from "ramda";
import { z } from "zod";
import { ResponseVariant } from "./api-response";
import {
  FlatObject,
  combinations,
  getExamples,
  getRoutePathParams,
  hasCoercion,
  makeCleanId,
  routePathParamsRegex,
  getTransformedType,
  ucFirst,
  Tag,
} from "./common-helpers";
import { InputSource } from "./config-type";
import { DateInSchema, ezDateInBrand } from "./date-in-schema";
import { DateOutSchema, ezDateOutBrand } from "./date-out-schema";
import { DocumentationError } from "./errors";
import { FileSchema, ezFileBrand } from "./file-schema";
import { extractObjectSchema, IOSchema } from "./io-schema";
import { Alternatives } from "./logical-container";
import { metaSymbol } from "./metadata";
import { Method } from "./method";
import { ProprietaryBrand } from "./proprietary-schemas";
import { RawSchema, ezRawBrand } from "./raw-schema";
import { HandlingRules, SchemaHandler, walkSchema } from "./schema-walker";
import { Security } from "./security";
import { UploadSchema, ezUploadBrand } from "./upload-schema";
import wellKnownHeaders from "./well-known-headers.json";

export interface OpenAPIContext extends FlatObject {
  isResponse: boolean;
  makeRef: (
    schema: z.ZodTypeAny,
    subject:
      | SchemaObject
      | ReferenceObject
      | (() => SchemaObject | ReferenceObject),
    name?: string,
  ) => ReferenceObject;
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
  extends Pick<OpenAPIContext, "makeRef" | "path" | "method"> {
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

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const timeRegex = /^\d{2}:\d{2}:\d{2}(\.\d+)?$/;

const getTimestampRegex = (hasOffset?: boolean) =>
  hasOffset
    ? /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(([+-]\d{2}:\d{2})|Z)$/
    : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

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
  if (ctx.isResponse)
    throw new DocumentationError("Please use ez.upload() only for input.", ctx);
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

export const depictIntersection: Depicter = (
  { _def: { left, right } }: z.ZodIntersection<z.ZodTypeAny, z.ZodTypeAny>,
  { next },
) => intersect([left, right].map(next));

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
  if (isSchemaObject(nested)) nested.type = makeNullableType(nested);
  return nested;
};

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
  if (keys.length) result.properties = depictObjectProperties(schema, next);
  if (required.length) result.required = required;
  return result;
};

/**
 * @see https://swagger.io/docs/specification/data-models/data-types/
 * @since OAS 3.1: using type: "null"
 * */
export const depictNull: Depicter = () => ({ type: "null" });

export const depictDateIn: Depicter = ({}: DateInSchema, ctx) => {
  if (ctx.isResponse)
    throw new DocumentationError("Please use ez.dateOut() for output.", ctx);
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
  if (!ctx.isResponse)
    throw new DocumentationError("Please use ez.dateIn() for input.", ctx);
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
export const depictDate: Depicter = ({}: z.ZodDate, ctx) => {
  throw new DocumentationError(
    `Using z.date() within ${
      ctx.isResponse ? "output" : "input"
    } schema is forbidden. Please use ez.date${
      ctx.isResponse ? "Out" : "In"
    }() instead. Check out the documentation for details.`,
    ctx,
  );
};

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
        z.object(R.fromPairs(R.xprod(keys, [valueSchema]))),
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
    const required = R.map((opt) => `${opt.value}`, keySchema.options);
    const shape = R.fromPairs(R.xprod(required, [valueSchema]));
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
  if (minLength) result.minItems = minLength.value;
  if (maxLength) result.maxItems = maxLength.value;
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
  isCIDR,
  isDate,
  isTime,
  isBase64,
  isNANOID,
  isBase64url,
  isDuration,
  _def: { checks },
}: z.ZodString) => {
  const regexCheck = checks.find((check) => check.kind === "regex");
  const datetimeCheck = checks.find((check) => check.kind === "datetime");
  const isJWT = checks.some((check) => check.kind === "jwt");
  const lenCheck = checks.find((check) => check.kind === "length");
  const result: SchemaObject = { type: "string" };
  const formats: Record<NonNullable<SchemaObject["format"]>, boolean> = {
    "date-time": isDatetime,
    byte: isBase64,
    base64url: isBase64url,
    date: isDate,
    time: isTime,
    duration: isDuration,
    email: isEmail,
    url: isURL,
    uuid: isUUID,
    cuid: isCUID,
    cuid2: isCUID2,
    ulid: isULID,
    nanoid: isNANOID,
    jwt: isJWT,
    ip: isIP,
    cidr: isCIDR,
    emoji: isEmoji,
  };
  for (const format in formats) {
    if (formats[format]) {
      result.format = format;
      break;
    }
  }
  if (lenCheck)
    [result.minLength, result.maxLength] = [lenCheck.value, lenCheck.value];
  if (minLength !== null) result.minLength = minLength;
  if (maxLength !== null) result.maxLength = maxLength;
  if (isDate) result.pattern = dateRegex.source;
  if (isTime) result.pattern = timeRegex.source;
  if (isDatetime)
    result.pattern = getTimestampRegex(datetimeCheck?.offset).source;
  if (regexCheck) result.pattern = regexCheck.regex.source;
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
  if (isMinInclusive) result.minimum = minimum;
  else result.exclusiveMinimum = minimum;
  if (isMaxInclusive) result.maximum = maximum;
  else result.exclusiveMaximum = maximum;
  return result;
};

export const depictObjectProperties = (
  { shape }: z.ZodObject<z.ZodRawShape>,
  next: Parameters<Depicter>[1]["next"],
) => R.map(next, shape);

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

export const depictEffect: Depicter = (
  schema: z.ZodEffects<z.ZodTypeAny>,
  { isResponse, next },
) => {
  const input = next(schema.innerType());
  const { effect } = schema._def;
  if (isResponse && effect.type === "transform" && isSchemaObject(input)) {
    const outputType = getTransformedType(schema, makeSample(input));
    if (outputType && ["number", "string", "boolean"].includes(outputType))
      return { type: outputType as "number" | "string" | "boolean" };
    else return next(z.any());
  }
  if (!isResponse && effect.type === "preprocess" && isSchemaObject(input)) {
    const { type: inputType, ...rest } = input;
    return { ...rest, format: `${rest.format || inputType} (preprocessed)` };
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
  lazy: z.ZodLazy<z.ZodTypeAny>,
  { next, makeRef },
): ReferenceObject => makeRef(lazy, () => next(lazy.schema));

export const depictRaw: Depicter = (schema: RawSchema, { next }) =>
  next(schema.unwrap().shape.raw);

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
  schema: z.ZodTypeAny,
  isResponse: boolean,
  omitProps: string[] = [],
): ExamplesObject | undefined =>
  R.pipe(
    getExamples,
    R.map(R.when((subj) => R.type(subj) === "Object", R.omit(omitProps))),
    enumerateExamples,
  )({
    schema,
    variant: isResponse ? "parsed" : "original",
    validate: true,
    pullProps: true,
  });

export const depictParamExamples = (
  schema: z.ZodTypeAny,
  param: string,
): ExamplesObject | undefined =>
  R.pipe(
    getExamples,
    R.filter<FlatObject>(R.has(param)),
    R.pluck(param),
    enumerateExamples,
  )({ schema, variant: "original", validate: true, pullProps: true });

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
        rules: { ...brandHandling, ...depicters },
        onEach,
        onMissing,
        ctx: { isResponse: false, makeRef, path, method },
      });
      const result =
        composition === "components"
          ? makeRef(paramSchema, depicted, makeCleanId(description, name))
          : depicted;
      const { _def } = paramSchema as z.ZodType;
      return acc.concat({
        name,
        in: location,
        deprecated: _def[metaSymbol]?.isDeprecated,
        required: !paramSchema.isOptional(),
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
> = (schema: z.ZodType, { isResponse, prev }) => {
  if (isReferenceObject(prev)) return {};
  const { description, _def } = schema;
  const shouldAvoidParsing = schema instanceof z.ZodLazy;
  const hasTypePropertyInDepiction = prev.type !== undefined;
  const isResponseHavingCoercion = isResponse && hasCoercion(schema);
  const isActuallyNullable =
    !shouldAvoidParsing &&
    hasTypePropertyInDepiction &&
    !isResponseHavingCoercion &&
    schema.isNullable();
  const result: SchemaObject = {};
  if (description) result.description = description;
  if (_def[metaSymbol]?.isDeprecated) result.deprecated = true;
  if (isActuallyNullable) result.type = makeNullableType(prev);
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
  depicted: SchemaObject | ReferenceObject,
  names: string[],
): SchemaObject | ReferenceObject => {
  if (isReferenceObject(depicted)) return depicted;
  return R.mapObjIndexed((v, k) => {
    if (k === "properties") return R.omit(names, v);
    if (k === "examples") return R.map(R.omit(names), v);
    if (k === "required") return R.reject(R.includes(R.__, names), v);
    if (["allOf", "oneOf"].includes(k))
      return R.map((entry) => excludeParamsFromDepiction(entry, names), v);
    return v;
  }, depicted);
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
      rules: { ...brandHandling, ...depicters },
      onEach,
      onMissing,
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
  const bodyDepiction = excludeExamplesFromDepiction(
    excludeParamsFromDepiction(
      walkSchema(schema, {
        rules: { ...brandHandling, ...depicters },
        onEach,
        onMissing,
        ctx: { isResponse: false, makeRef, path, method },
      }),
      paramNames,
    ),
  );
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
  // @todo it can be allOf/oneOf, should rather repurpose excludeParamsFromDepiction()
  if (isSchemaObject(bodyDepiction) && Boolean(bodyDepiction.required?.length))
    body.required = true;
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
