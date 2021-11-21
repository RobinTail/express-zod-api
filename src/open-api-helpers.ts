import {
  ExampleObject,
  ExamplesObject,
  MediaTypeObject,
  ParameterObject,
  SchemaObject,
} from "openapi3-ts";
import { z } from "zod";
import {
  ArrayElement,
  extractObjectSchema,
  getExamples,
  getRoutePathParams,
  IOSchema,
} from "./common-helpers";
import { OpenAPIError } from "./errors";
import { ZodFile } from "./file-schema";
import { Method } from "./method";
import { ZodUpload } from "./upload-schema";

type MediaExamples = Pick<MediaTypeObject, "examples">;

/* eslint-disable @typescript-eslint/no-use-before-define */
export const depictSchema = (
  schema: z.ZodTypeAny,
  isResponse: boolean
): SchemaObject => {
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
  switch (true) {
    case schema instanceof z.ZodString:
      return depictString(schema as z.ZodString, initial);
    case schema instanceof z.ZodNumber:
      return depictNumber(schema as z.ZodNumber, initial);
    case schema instanceof z.ZodBigInt:
      return depictBigInt(initial);
    case schema instanceof z.ZodBoolean:
      return depictBoolean(initial);
    case schema instanceof z.ZodDate:
      return depictDate(initial);
    case schema instanceof z.ZodNull:
      return depictNull(initial);
    case schema instanceof z.ZodArray:
      return depictArray(
        schema as z.ZodArray<z.ZodTypeAny>,
        initial,
        isResponse
      );
    case schema instanceof z.ZodTuple:
      return depictTuple(schema as z.ZodTuple, initial, isResponse);
    case schema instanceof z.ZodRecord:
      return depictRecord(
        schema as z.ZodRecord<z.ZodTypeAny>,
        initial,
        isResponse
      );
    case schema instanceof z.ZodObject:
      return depictObject(schema as z.AnyZodObject, initial, isResponse);
    case schema instanceof z.ZodLiteral:
      return depictLiteral(schema as z.ZodLiteral<any>, initial);
    case schema instanceof z.ZodEnum:
    case schema instanceof z.ZodNativeEnum:
      return depictEnum(schema, initial);
    case schema instanceof z.ZodTransformer:
    case schema instanceof z.ZodEffects:
      return depictEffect(
        schema as z.ZodEffects<any> | z.ZodTransformer<any>,
        initial,
        isResponse
      );
    case schema instanceof z.ZodOptional:
    case schema instanceof z.ZodNullable:
      return depictOptionalOrNullable(
        schema as z.ZodOptional<any> | z.ZodNullable<any>,
        initial,
        isResponse
      );
    case schema instanceof z.ZodIntersection:
      return depictIntersection(schema, initial, isResponse);
    case schema instanceof z.ZodUnion:
      return depictUnion(
        schema as z.ZodUnion<[z.ZodTypeAny, ...z.ZodTypeAny[]]>,
        initial,
        isResponse
      );
    case schema instanceof ZodFile:
      return depictFile(schema as ZodFile, initial);
    case schema instanceof ZodUpload:
      return depictUpload(initial);
    case schema instanceof z.ZodAny:
      return depictAny(initial);
    case schema instanceof z.ZodDefault:
      return depictDefault(schema as z.ZodDefault<any>, initial, isResponse);
    case schema instanceof z.ZodUndefined:
    case schema instanceof z.ZodMap:
    case schema instanceof z.ZodFunction:
    case schema instanceof z.ZodLazy:
    case schema instanceof z.ZodPromise:
    case schema instanceof z.ZodUnknown:
    case schema instanceof z.ZodNever:
    case schema instanceof z.ZodVoid:
    default:
      throw new OpenAPIError(
        `Zod type ${schema.constructor.name} is unsupported`
      );
  }
};

const depictDefault = (
  { _def: { innerType, defaultValue } }: z.ZodDefault<any>,
  initial: SchemaObject,
  isResponse: boolean
): SchemaObject => ({
  ...initial,
  ...depictSchema(innerType, isResponse),
  default: defaultValue(),
});

const depictAny = (initial: SchemaObject): SchemaObject => ({
  ...initial,
  format: "any",
});

const depictUpload = (initial: SchemaObject): SchemaObject => ({
  ...initial,
  type: "string",
  format: "binary",
});

const depictFile = (
  { isBinary, isBase64 }: ZodFile,
  initial: SchemaObject
): SchemaObject => ({
  ...initial,
  type: "string",
  format: isBinary ? "binary" : isBase64 ? "byte" : "file",
});

const depictUnion = (
  { _def: { options } }: z.ZodUnion<[z.ZodTypeAny, ...z.ZodTypeAny[]]>,
  initial: SchemaObject,
  isResponse: boolean
): SchemaObject => ({
  ...initial,
  oneOf: options.map((option) => depictSchema(option, isResponse)),
});

const depictIntersection = (
  { _def: { left, right } }: z.ZodIntersection<z.ZodTypeAny, z.ZodTypeAny>,
  initial: SchemaObject,
  isResponse: boolean
): SchemaObject => ({
  ...initial,
  allOf: [depictSchema(left, isResponse), depictSchema(right, isResponse)],
});

const depictOptionalOrNullable = (
  schema: z.ZodOptional<any> | z.ZodNullable<any>,
  initial: SchemaObject,
  isResponse: boolean
): SchemaObject => ({
  ...initial,
  ...depictSchema(schema.unwrap(), isResponse),
});

const depictEnum = (
  { _def: { values } }: z.ZodEnum<any> | z.ZodNativeEnum<any>,
  initial: SchemaObject
): SchemaObject => ({
  ...initial,
  type: typeof Object.values(values)[0] as "string" | "number",
  enum: Object.values(values),
});

const depictLiteral = (
  { _def: { value } }: z.ZodLiteral<any>,
  initial: SchemaObject
): SchemaObject => ({
  ...initial,
  type: typeof value as "string" | "number" | "boolean",
  enum: [value],
});

const depictObject = (
  schema: z.AnyZodObject,
  initial: SchemaObject,
  isResponse: boolean
): SchemaObject => ({
  ...initial,
  type: "object",
  properties: depictObjectProperties(schema, isResponse),
  required: Object.keys(schema.shape).filter(
    (key) => !schema.shape[key].isOptional()
  ),
});

/** @see https://swagger.io/docs/specification/data-models/data-types/ */
const depictNull = (initial: SchemaObject): SchemaObject => ({
  ...initial,
  type: "string",
  nullable: true,
  format: "null",
});

const depictDate = (initial: SchemaObject): SchemaObject => ({
  ...initial,
  type: "string",
  format: "date",
});

const depictBoolean = (initial: SchemaObject): SchemaObject => ({
  ...initial,
  type: "boolean",
});

const depictBigInt = (initial: SchemaObject): SchemaObject => ({
  ...initial,
  type: "integer",
  format: "bigint",
});

const depictRecord = (
  { _def: def }: z.ZodRecord<z.ZodTypeAny>,
  initial: SchemaObject,
  isResponse: boolean
): SchemaObject => {
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
      properties: depictObjectProperties(z.object(shape), isResponse),
      required: keys,
    };
  }
  if (def.keyType instanceof z.ZodLiteral) {
    return {
      ...initial,
      type: "object",
      properties: depictObjectProperties(
        z.object({
          [def.keyType._def.value]: def.valueType,
        }),
        isResponse
      ),
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
        properties: depictObjectProperties(z.object(shape), isResponse),
        required: def.keyType.options.map(
          (option: z.ZodLiteral<any>) => option.value
        ),
      };
    }
  }
  return {
    type: "object",
    additionalProperties: depictSchema(def.valueType, isResponse),
  };
};

const depictArray = (
  { _def: def }: z.ZodArray<z.ZodTypeAny>,
  initial: SchemaObject,
  isResponse: boolean
): SchemaObject => ({
  ...initial,
  type: "array",
  items: depictSchema(def.type, isResponse),
  ...(def.minLength ? { minItems: def.minLength.value } : {}),
  ...(def.maxLength ? { maxItems: def.maxLength?.value } : {}),
});

/** @todo improve it when OpenAPI 3.1.0 will be released */
const depictTuple = (
  { items }: z.ZodTuple,
  initial: SchemaObject,
  isResponse: boolean
): SchemaObject => {
  const types = items.map((item) => depictSchema(item, isResponse));
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

const depictString = (
  { _def: { checks } }: z.ZodString,
  initial: SchemaObject
): SchemaObject => {
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

const depictNumber = (
  schema: z.ZodNumber,
  initial: SchemaObject
): SchemaObject => {
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

const depictObjectProperties = (
  { shape }: z.AnyZodObject,
  isResponse: boolean
): Record<string, SchemaObject> => {
  return Object.keys(shape).reduce(
    (carry, key) => ({
      ...carry,
      [key]: depictSchema(shape[key], isResponse),
    }),
    {} as Record<string, SchemaObject>
  );
};

const depictEffect = (
  schema: z.ZodEffects<any>,
  initial: SchemaObject,
  isResponse: boolean
): SchemaObject => {
  const input = depictSchema(schema._def.schema, isResponse);
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
          : undefined
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
    examples: examples.reduce<ExamplesObject>((carry, example, index) => {
      for (const prop of omitProps) {
        delete example[prop];
      }
      return {
        ...carry,
        [`example${index + 1}`]: <ExampleObject>{
          value: example,
        },
      };
    }, {}),
  };
};

const depictIOParamExamples = <T extends IOSchema>(
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

export const depictParams = (
  path: string,
  method: Method,
  schema: IOSchema
): ParameterObject[] => {
  const shape = extractObjectSchema(schema).shape;
  const pathParams = getRoutePathParams(path);
  return Object.keys(shape)
    .filter((name) => method === "get" || pathParams.includes(name))
    .map((name) => ({
      name,
      in: pathParams.includes(name) ? "path" : "query",
      required: !shape[name].isOptional(),
      schema: {
        description: `${method.toUpperCase()} ${path} parameter`,
        ...depictSchema(shape[name], false),
      },
      ...depictIOParamExamples(schema, false, name),
    }));
};

export const excludeParamFromDepiction = (
  depicted: SchemaObject,
  pathParam: string
) => {
  if (depicted.properties) {
    if (pathParam in depicted.properties) {
      delete depicted.properties[pathParam];
    }
  }
  if (depicted.required) {
    depicted.required = depicted.required.filter((name) => name !== pathParam);
  }
};
