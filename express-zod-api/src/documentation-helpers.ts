import type {
  $ZodArray,
  $ZodCatch,
  $ZodDate,
  $ZodDefault,
  $ZodDiscriminatedUnion,
  $ZodEnum,
  $ZodIntersection,
  $ZodLazy,
  $ZodLiteral,
  $ZodNullable,
  $ZodObject,
  $ZodOptional,
  $ZodPipe,
  $ZodRecord,
  $ZodTuple,
  $ZodType,
  $ZodUnion,
  $ZodChecks,
  $ZodTypeDef,
  $ZodCheckMinLength,
  $ZodCheckMaxLength,
  $ZodString,
  $ZodCheckRegex,
  $ZodISODateTime,
  $ZodJWT,
  $ZodCheckLengthEquals,
  $ZodISODate,
  $ZodISOTime,
  $ZodNumber,
  $ZodCheckGreaterThan,
  $ZodCheckLessThan,
} from "@zod/core";
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
import { globalRegistry, z } from "zod";
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
import { hasRaw } from "./deep-checks";
import { DocumentationError } from "./errors";
import { FileSchema, ezFileBrand } from "./file-schema";
import { extractObjectSchema, IOSchema } from "./io-schema";
import { Alternatives } from "./logical-container";
import { metaSymbol } from "./metadata";
import { Method } from "./method";
import { ProprietaryBrand } from "./proprietary-schemas";
import { RawSchema, ezRawBrand } from "./raw-schema";
import {
  FirstPartyKind,
  HandlingRules,
  SchemaHandler,
  walkSchema,
} from "./schema-walker";
import { Security } from "./security";
import { UploadSchema, ezUploadBrand } from "./upload-schema";
import wellKnownHeaders from "./well-known-headers.json";

export type NumericRange = Record<"integer" | "float", [number, number]>;

export interface OpenAPIContext extends FlatObject {
  isResponse: boolean;
  makeRef: (
    schema: $ZodType,
    subject:
      | SchemaObject
      | ReferenceObject
      | (() => SchemaObject | ReferenceObject),
    name?: string,
  ) => ReferenceObject;
  numericRange?: NumericRange | null;
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
  extends Pick<OpenAPIContext, "makeRef" | "path" | "method" | "numericRange"> {
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

export const depictDefault: Depicter = (schema: $ZodDefault, { next }) => ({
  ...next(schema._zod.def.innerType),
  default:
    globalRegistry.get(schema)?.[metaSymbol]?.defaultLabel ||
    schema._zod.def.defaultValue(),
});

export const depictCatch: Depicter = ({ _zod: { def } }: $ZodCatch, { next }) =>
  next(def.innerType);

export const depictAny: Depicter = () => ({ format: "any" });

export const depictUpload: Depicter = ({}: UploadSchema, ctx) => {
  if (ctx.isResponse)
    throw new DocumentationError("Please use ez.upload() only for input.", ctx);
  return { type: "string", format: "binary" };
};

export const depictFile: Depicter = (schema: FileSchema) => {
  return {
    type: "string",
    format:
      schema instanceof z.ZodString
        ? schema._zod.def.checks?.find(
            (check) => check._zod.def.check === "base64",
          )
          ? "byte"
          : "file"
        : "binary",
  };
};

export const depictUnion: Depicter = (
  { _zod }: $ZodUnion | $ZodDiscriminatedUnion,
  { next },
) => ({
  oneOf: _zod.def.options.map(next),
});

// @todo add possible discriminator to depictUnion, this should be deleted
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
  { _zod: { def } }: $ZodIntersection,
  { next },
) => intersect([def.left, def.right].map(next));

export const depictOptional: Depicter = (
  { _zod: { def } }: $ZodOptional,
  { next },
) => next(def.innerType);

// @todo consider extracting into one method utilizing innerType
export const depictReadonly: Depicter = (
  { _zod: { def } }: z.ZodReadonly<z.ZodTypeAny>,
  { next },
) => next(def.innerType);

/** @since OAS 3.1 nullable replaced with type array having null */
export const depictNullable: Depicter = (
  { _zod: { def } }: $ZodNullable,
  { next },
) => {
  const nested = next(def.innerType);
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

export const depictEnum: Depicter = ({ _zod: { def } }: $ZodEnum) => ({
  type: getSupportedType(Object.values(def.entries)[0]),
  enum: Object.values(def.entries),
});

// @todo looks very similar to depictEnum, also takes values twice
export const depictLiteral: Depicter = ({ _zod: { def } }: $ZodLiteral) => ({
  type: getSupportedType(Object.values(def.values)),
  enum: Object.values(def.values),
});

export const depictObject: Depicter = (
  schema: $ZodObject,
  { isResponse, next },
) => {
  const keys = Object.keys(schema._zod.def.shape);
  const isOptionalProp = (prop: $ZodType) =>
    isResponse && hasCoercion(prop)
      ? prop instanceof z.ZodOptional
      : (isResponse ? prop._zod.qout : prop._zod.qin) === "true";
  const required = keys.filter(
    (key) => !isOptionalProp(schema._zod.def.shape[key]),
  );
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
export const depictDate: Depicter = ({}: $ZodDate, ctx) => {
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
  subject: ReadonlyArray<$ZodType>,
): subject is $ZodLiteral[] =>
  subject.every((option) => option._zod.def.type === "literal");

// @todo consider more checks instead of "as string"
export const depictRecord: Depicter = (
  { _zod: { def } }: $ZodRecord,
  { next },
) => {
  if (def.keyType._zod.def.type === "enum") {
    const keys = Object.values(
      (def.keyType as $ZodEnum)._zod.def.entries,
    ) as string[];
    const result: SchemaObject = { type: "object" };
    if (keys.length) {
      result.properties = depictObjectProperties(
        z.looseObject(R.fromPairs(R.xprod(keys, [def.valueType]))),
        next,
      );
      result.required = keys;
    }
    return result;
  }
  if (def.keyType._zod.def.type === "literal") {
    return {
      type: "object",
      properties: depictObjectProperties(
        z.looseObject({
          [(def.keyType as $ZodLiteral)._zod.def.values[0] as string]:
            def.valueType,
        }),
        next,
      ),
      required: [(def.keyType as $ZodLiteral)._zod.def.values[0] as string],
    };
  }
  if (
    def.keyType._zod.def.type === "union" &&
    areOptionsLiteral((def.keyType as $ZodUnion)._zod.def.options)
  ) {
    const required = R.map(
      (opt: $ZodLiteral) => `${opt._zod.def.values[0]}`,
      (def.keyType as $ZodUnion)._zod.def.options as unknown as $ZodLiteral[], // ensured above
    );
    const shape = R.fromPairs(R.xprod(required, [def.valueType]));
    return {
      type: "object",
      properties: depictObjectProperties(z.looseObject(shape), next),
      required,
    };
  }
  return { type: "object", additionalProperties: next(def.valueType) };
};

const getCheck = <T extends $ZodChecks>(
  def: $ZodTypeDef,
  name: T["_zod"]["def"]["check"],
  format?: T extends { _zod: { def: { format: string } } }
    ? T["_zod"]["def"]["format"]
    : never,
): T["_zod"]["def"] | undefined =>
  R.find(
    R.both(
      R.pathEq(name, ["_zod", "def", "check"]),
      format ? R.pathEq(format, ["_zod", "def", "format"]) : R.T,
    ),
    (def.checks || []) as $ZodChecks[],
  )?._zod.def;

// @todo should also have exact length check
export const depictArray: Depicter = (
  { _zod: { def } }: $ZodArray,
  { next },
) => {
  const result: SchemaObject = {
    type: "array",
    items: next(def.element),
  };
  const minCheck = getCheck<$ZodCheckMinLength>(def, "min_length");
  const maxCheck = getCheck<$ZodCheckMaxLength>(def, "max_length");
  if (minCheck) result.minItems = minCheck.minimum;
  if (maxCheck) result.maxItems = maxCheck.maximum;
  return result;
};

/**
 * @since OAS 3.1 using prefixItems for depicting tuples
 * @since 17.5.0 added rest handling, fixed tuple type
 * */
export const depictTuple: Depicter = (
  { _zod: { def } }: $ZodTuple,
  { next },
) => ({
  type: "array",
  prefixItems: def.items.map(next),
  // does not appear to support items:false, so not:{} is a recommended alias
  items: def.rest === null ? { not: {} } : next(def.rest),
});

export const depictString: Depicter = ({ _zod: { def } }: $ZodString) => {
  const minCheck = getCheck<$ZodCheckMinLength>(def, "min_length");
  const maxCheck = getCheck<$ZodCheckMaxLength>(def, "max_length");
  const regexCheck = getCheck<$ZodCheckRegex>(def, "string_format", "regex");
  const dateCheck = getCheck<$ZodISODate>(def, "string_format", "date");
  const timeCheck = getCheck<$ZodISOTime>(def, "string_format", "time");
  const datetimeCheck = getCheck<$ZodISODateTime>(
    def,
    "string_format",
    "datetime",
  );
  const jwtCheck = getCheck<$ZodJWT>(def, "string_format", "jwt");
  const lenCheck = getCheck<$ZodCheckLengthEquals>(def, "length_equals");
  const result: SchemaObject = { type: "string" };
  // @todo should rather invoke those methods inside the loop below to avoid so much lookup
  const formats: Record<NonNullable<SchemaObject["format"]>, boolean> = {
    "date-time": !!datetimeCheck,
    byte: !!getCheck(def, "string_format", "base64"),
    base64url: !!getCheck(def, "string_format", "base64url"),
    date: !!dateCheck,
    time: !!timeCheck,
    duration: !!getCheck(def, "string_format", "duration"),
    email: !!getCheck(def, "string_format", "email"),
    url: !!getCheck(def, "string_format", "url"),
    uuid: !!getCheck(def, "string_format", "uuid"),
    cuid: !!getCheck(def, "string_format", "cuid"),
    cuid2: !!getCheck(def, "string_format", "cuid2"),
    ulid: !!getCheck(def, "string_format", "ulid"),
    nanoid: !!getCheck(def, "string_format", "nanoid"),
    jwt: !!jwtCheck,
    ip:
      !!getCheck(def, "string_format", "ipv4") ||
      !!getCheck(def, "string_format", "ipv6"),
    cidr:
      !!getCheck(def, "string_format", "cidrv4") ||
      !!getCheck(def, "string_format", "cidrv6"),
    emoji: !!getCheck(def, "string_format", "emoji"),
  };
  for (const format in formats) {
    if (formats[format]) {
      result.format = format;
      break;
    }
  }
  if (lenCheck)
    [result.minLength, result.maxLength] = [lenCheck.length, lenCheck.length];
  if (minCheck) result.minLength = minCheck.minimum;
  if (maxCheck) result.maxLength = maxCheck.maximum;
  if (dateCheck) result.pattern = dateRegex.source;
  if (timeCheck) result.pattern = timeRegex.source;
  if (datetimeCheck)
    result.pattern = getTimestampRegex(datetimeCheck.offset).source;
  if (regexCheck) result.pattern = regexCheck.pattern.source;
  return result;
};

/** @since OAS 3.1: exclusive min/max are numbers */
export const depictNumber: Depicter = (
  { _zod: { def } }: $ZodNumber,
  {
    numericRange = {
      integer: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
      float: [-Number.MAX_VALUE, Number.MAX_VALUE],
    },
  },
) => {
  const { integer: intRange, float: floatRange } = numericRange || {
    integer: null,
    float: null,
  };
  // @todo should also test z.int, z.int32, z.int64
  const intCheck = getCheck(def, "number_format", "safeint");
  console.log(def.checks);
  const minCheck = getCheck<$ZodCheckGreaterThan>(def, "greater_than");
  const minimum = !minCheck
    ? intCheck
      ? intRange?.[0]
      : floatRange?.[0]
    : Number(minCheck.value);
  const isMinInclusive = minCheck ? minCheck.inclusive : true;
  const maxCheck = getCheck<$ZodCheckLessThan>(def, "less_than");
  const maximum = !maxCheck
    ? intCheck
      ? intRange?.[1]
      : floatRange?.[1]
    : Number(maxCheck.value);
  const isMaxInclusive = maxCheck ? maxCheck.inclusive : true;
  const result: SchemaObject = {
    type: intCheck ? "integer" : "number",
    format: intCheck ? "int64" : "double", // @todo should probably use int32
  };
  if (isMinInclusive) result.minimum = minimum;
  else result.exclusiveMinimum = minimum;
  if (isMaxInclusive) result.maximum = maximum;
  else result.exclusiveMaximum = maximum;
  return result;
};

export const depictObjectProperties = (
  { _zod: { def } }: $ZodObject,
  next: Parameters<Depicter>[1]["next"],
) => R.map(next, def.shape);

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

export const depictPipeline: Depicter = (
  { _zod: { def } }: $ZodPipe,
  { isResponse, next },
) => {
  const target = def[isResponse ? "out" : "in"];
  const opposite = def[isResponse ? "in" : "out"];
  if (target._zod.def.type === "transform") {
    const opposingDepiction = next(opposite);
    if (isSchemaObject(opposingDepiction)) {
      if (!isResponse) {
        const { type: opposingType, ...rest } = opposingDepiction;
        return {
          ...rest,
          format: `${rest.format || opposingType} (preprocessed)`,
        };
      } else {
        const opposingType = getTransformedType(
          def.out as z.ZodTransform, // @todo should use $ZodTransform from core?
          makeSample(opposingDepiction),
        );
        if (
          opposingType &&
          ["number", "string", "boolean"].includes(opposingType)
        )
          return { type: opposingType as "number" | "string" | "boolean" };
        else return next(z.any());
      }
    }
  }
  return next(target);
};

export const depictLazy: Depicter = (
  lazy: $ZodLazy,
  { next, makeRef },
): ReferenceObject => makeRef(lazy, () => next(lazy._zod.def.getter()));

export const depictRaw: Depicter = ({ _zod: { def } }: RawSchema, { next }) =>
  next(def.shape.raw);

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
  numericRange,
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
        ctx: { isResponse: false, makeRef, path, method, numericRange },
      });
      const result =
        composition === "components"
          ? makeRef(paramSchema, depicted, makeCleanId(description, name))
          : depicted;
      return acc.concat({
        name,
        in: location,
        deprecated: (paramSchema as z.ZodType).meta()?.[metaSymbol] // @todo revisit for the need of "as"
          ?.isDeprecated,
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
  FirstPartyKind | ProprietaryBrand
> = {
  string: depictString,
  number: depictNumber,
  bigint: depictBigInt,
  boolean: depictBoolean,
  null: depictNull,
  array: depictArray,
  tuple: depictTuple,
  record: depictRecord,
  object: depictObject,
  literal: depictLiteral,
  intersection: depictIntersection,
  union: depictUnion,
  any: depictAny,
  default: depictDefault,
  enum: depictEnum,
  optional: depictOptional,
  nullable: depictNullable,
  date: depictDate,
  catch: depictCatch,
  pipe: depictPipeline,
  lazy: depictLazy,
  readonly: depictReadonly,
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
  const { description } = schema;
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
  if (schema.meta()?.[metaSymbol]?.isDeprecated) result.deprecated = true;
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
  numericRange,
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
      ctx: { isResponse: true, makeRef, path, method, numericRange },
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
  numericRange,
  description = `${method.toUpperCase()} ${path} Request body`,
}: ReqResHandlingProps<IOSchema> & {
  mimeType: string;
  paramNames: string[];
}) => {
  const [withoutParams, hasRequired] = excludeParamsFromDepiction(
    walkSchema(schema, {
      rules: { ...brandHandling, ...depicters },
      onEach,
      onMissing,
      ctx: { isResponse: false, makeRef, path, method, numericRange },
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
