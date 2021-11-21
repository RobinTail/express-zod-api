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
  value: z.ZodTypeAny,
  isResponse: boolean
): SchemaObject => {
  const otherProps: SchemaObject = {};
  if (value.isNullable()) {
    otherProps.nullable = true;
  }
  if (value.description) {
    otherProps.description = `${value.description}`;
  }
  const examples = getExamples(value, isResponse);
  if (examples.length > 0) {
    otherProps.example = examples[0];
  }
  switch (true) {
    case value instanceof z.ZodString:
      return {
        ...otherProps,
        ...depictString(value as z.ZodString),
      };
    case value instanceof z.ZodNumber:
      return {
        ...otherProps,
        ...depictNumber(value as z.ZodNumber),
      };
    case value instanceof z.ZodBigInt:
      return { ...otherProps, type: "integer", format: "bigint" };
    case value instanceof z.ZodBoolean:
      return { ...otherProps, type: "boolean" };
    case value instanceof z.ZodDate:
      return { ...otherProps, type: "string", format: "date" };
    case value instanceof z.ZodNull:
      // null is not supported https://swagger.io/docs/specification/data-models/data-types/
      return { ...otherProps, type: "string", nullable: true, format: "null" };
    case value instanceof z.ZodArray:
      return {
        ...otherProps,
        ...depictArray(value._def as z.ZodArrayDef, isResponse),
      };
    case value instanceof z.ZodTuple:
      return {
        ...otherProps,
        ...depictTuple(value as z.ZodTuple, isResponse),
      };
    case value instanceof z.ZodRecord:
      return {
        ...otherProps,
        ...depictRecord((value as z.ZodRecord<z.ZodTypeAny>)._def, isResponse),
      };
    case value instanceof z.ZodObject:
      return {
        ...otherProps,
        type: "object",
        properties: depictObjectProperties(value as z.AnyZodObject, isResponse),
        required: Object.keys((value as z.AnyZodObject).shape).filter(
          (key) => !(value as z.AnyZodObject).shape[key].isOptional()
        ),
      };
    case value instanceof z.ZodLiteral:
      return {
        ...otherProps,
        type: typeof value._def.value as "string" | "number" | "boolean",
        enum: [value._def.value],
      };
    case value instanceof z.ZodEnum:
    case value instanceof z.ZodNativeEnum:
      return {
        ...otherProps,
        type: typeof Object.values(value._def.values)[0] as "string" | "number",
        enum: Object.values(value._def.values),
      };
    case value instanceof z.ZodTransformer:
    case value instanceof z.ZodEffects:
      return {
        ...otherProps,
        ...depictEffect(
          value as z.ZodEffects<any> | z.ZodTransformer<any>,
          isResponse
        ),
      };
    case value instanceof z.ZodOptional:
    case value instanceof z.ZodNullable:
      return {
        ...otherProps,
        ...depictSchema(
          (
            value as z.ZodOptional<z.ZodTypeAny> | z.ZodNullable<z.ZodTypeAny>
          ).unwrap(),
          isResponse
        ),
      };
    case value instanceof z.ZodIntersection:
      return {
        ...otherProps,
        allOf: [
          depictSchema(
            (value as z.ZodIntersection<z.ZodTypeAny, z.ZodTypeAny>)._def.left,
            isResponse
          ),
          depictSchema(
            (value as z.ZodIntersection<z.ZodTypeAny, z.ZodTypeAny>)._def.right,
            isResponse
          ),
        ],
      };
    case value instanceof z.ZodUnion:
      return {
        ...otherProps,
        oneOf: (
          value as z.ZodUnion<[z.ZodTypeAny, ...z.ZodTypeAny[]]>
        )._def.options.map((schema) => depictSchema(schema, isResponse)),
      };
    case value instanceof ZodFile:
      return {
        ...otherProps,
        type: "string",
        format: (value as ZodFile).isBinary
          ? "binary"
          : (value as ZodFile).isBase64
          ? "byte"
          : "file",
      };
    case value instanceof ZodUpload:
      return {
        ...otherProps,
        type: "string",
        format: "binary",
      };
    case value instanceof z.ZodAny:
      return {
        ...otherProps,
        format: "any",
      };
    case value instanceof z.ZodDefault:
      return {
        ...otherProps,
        ...depictSchema((value._def as z.ZodDefaultDef).innerType, isResponse),
        default: (value._def as z.ZodDefaultDef).defaultValue(),
      };
    case value instanceof z.ZodUndefined:
    case value instanceof z.ZodMap:
    case value instanceof z.ZodFunction:
    case value instanceof z.ZodLazy:
    case value instanceof z.ZodPromise:
    case value instanceof z.ZodUnknown:
    case value instanceof z.ZodNever:
    case value instanceof z.ZodVoid:
    default:
      throw new OpenAPIError(
        `Zod type ${value.constructor.name} is unsupported`
      );
  }
};

const depictRecord = (
  definition: z.ZodRecordDef<z.ZodTypeAny>,
  isResponse: boolean
): SchemaObject => {
  if (
    definition.keyType instanceof z.ZodEnum ||
    definition.keyType instanceof z.ZodNativeEnum
  ) {
    const keys = Object.values(definition.keyType._def.values) as string[];
    const shape = keys.reduce(
      (carry, key) => ({
        ...carry,
        [key]: definition.valueType,
      }),
      {} as z.ZodRawShape
    );
    return {
      type: "object",
      properties: depictObjectProperties(z.object(shape), isResponse),
      required: keys,
    };
  }
  if (definition.keyType instanceof z.ZodLiteral) {
    return {
      type: "object",
      properties: depictObjectProperties(
        z.object({
          [definition.keyType._def.value]: definition.valueType,
        }),
        isResponse
      ),
      required: [definition.keyType._def.value],
    };
  }
  if (definition.keyType instanceof z.ZodUnion) {
    const areOptionsLiteral = definition.keyType.options.reduce(
      (carry: boolean, option: z.ZodTypeAny) =>
        carry && option instanceof z.ZodLiteral,
      true
    );
    if (areOptionsLiteral) {
      const shape = definition.keyType.options.reduce(
        (carry: z.ZodRawShape, option: z.ZodLiteral<any>) => ({
          ...carry,
          [option.value]: definition.valueType,
        }),
        {} as z.ZodRawShape
      );
      return {
        type: "object",
        properties: depictObjectProperties(z.object(shape), isResponse),
        required: definition.keyType.options.map(
          (option: z.ZodLiteral<any>) => option.value
        ),
      };
    }
  }
  return {
    type: "object",
    additionalProperties: depictSchema(definition.valueType, isResponse),
  };
};

const depictArray = (
  definition: z.ZodArrayDef,
  isResponse: boolean
): SchemaObject => ({
  type: "array",
  items: depictSchema(definition.type, isResponse),
  ...(definition.minLength ? { minItems: definition.minLength.value } : {}),
  ...(definition.maxLength ? { maxItems: definition.maxLength?.value } : {}),
});

/** @todo improve it when OpenAPI 3.1.0 will be released */
const depictTuple = (schema: z.ZodTuple, isResponse: boolean): SchemaObject => {
  const types = schema.items.map((item) => depictSchema(item, isResponse));
  return {
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

const depictString = (schema: z.ZodString): SchemaObject => {
  const checks = schema._def.checks;
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

const depictNumber = (schema: z.ZodNumber): SchemaObject => {
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

const depictObjectProperties = (
  schema: z.AnyZodObject,
  isResponse: boolean
): Record<string, SchemaObject> => {
  return Object.keys(schema.shape).reduce(
    (carry, key) => ({
      ...carry,
      [key]: depictSchema(schema.shape[key], isResponse),
    }),
    {} as Record<string, SchemaObject>
  );
};

const depictEffect = (
  value: z.ZodEffects<any>,
  isResponse: boolean
): SchemaObject => {
  const input = depictSchema(value._def.schema, isResponse);
  const effect = value._def.effect;
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
      ...rest,
      format: `${rest.format || inputType} (preprocessed)`,
    };
  }
  return input;
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
