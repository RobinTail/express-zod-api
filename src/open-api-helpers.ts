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
type DepictHelper<T extends z.ZodType<any>> = (params: {
  schema: T;
  initial?: SchemaObject;
  isResponse: boolean;
}) => SchemaObject;

/* eslint-disable @typescript-eslint/no-use-before-define */
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
  let fn: DepictHelper<any> | null = null;
  if (schema instanceof z.ZodString) {
    fn = depictString;
  } else if (schema instanceof z.ZodNumber) {
    fn = depictNumber;
  } else if (schema instanceof z.ZodBigInt) {
    fn = depictBigInt;
  } else if (schema instanceof z.ZodBoolean) {
    fn = depictBoolean;
  } else if (schema instanceof z.ZodDate) {
    fn = depictDate;
  } else if (schema instanceof z.ZodNull) {
    fn = depictNull;
  } else if (schema instanceof z.ZodArray) {
    fn = depictArray;
  } else if (schema instanceof z.ZodTuple) {
    fn = depictTuple;
  } else if (schema instanceof z.ZodRecord) {
    fn = depictRecord;
  } else if (schema instanceof z.ZodObject) {
    fn = depictObject;
  } else if (schema instanceof z.ZodLiteral) {
    fn = depictLiteral;
  } else if (schema instanceof z.ZodIntersection) {
    fn = depictIntersection;
  } else if (schema instanceof z.ZodUnion) {
    fn = depictUnion;
  } else if (schema instanceof ZodFile) {
    fn = depictFile;
  } else if (schema instanceof ZodUpload) {
    fn = depictUpload;
  } else if (schema instanceof z.ZodAny) {
    fn = depictAny;
  } else if (schema instanceof z.ZodDefault) {
    fn = depictDefault;
  } else if (schema instanceof z.ZodEnum || schema instanceof z.ZodNativeEnum) {
    fn = depictEnum;
  } else if (
    schema instanceof z.ZodTransformer ||
    schema instanceof z.ZodEffects
  ) {
    fn = depictEffect;
  } else if (
    schema instanceof z.ZodOptional ||
    schema instanceof z.ZodNullable
  ) {
    fn = depictOptionalOrNullable;
  }
  if (!fn) {
    throw new OpenAPIError(
      `Zod type ${schema.constructor.name} is unsupported`
    );
  }
  return fn({ schema, initial, isResponse });
};

const depictDefault: DepictHelper<z.ZodDefault<z.ZodTypeAny>> = ({
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

const depictAny: DepictHelper<z.ZodAny> = ({ initial }) => ({
  ...initial,
  format: "any",
});

const depictUpload: DepictHelper<ZodUpload> = ({ initial }) => ({
  ...initial,
  type: "string",
  format: "binary",
});

const depictFile: DepictHelper<ZodFile> = ({
  schema: { isBinary, isBase64 },
  initial,
}) => ({
  ...initial,
  type: "string",
  format: isBinary ? "binary" : isBase64 ? "byte" : "file",
});

const depictUnion: DepictHelper<z.ZodUnion<[z.ZodTypeAny, ...z.ZodTypeAny[]]>> =
  ({
    schema: {
      _def: { options },
    },
    initial,
    isResponse,
  }) => ({
    ...initial,
    oneOf: options.map((option) =>
      depictSchema({ schema: option, isResponse })
    ),
  });

const depictIntersection: DepictHelper<
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

const depictOptionalOrNullable: DepictHelper<
  z.ZodOptional<any> | z.ZodNullable<any>
> = ({ schema, initial, isResponse }) => ({
  ...initial,
  ...depictSchema({ schema: schema.unwrap(), isResponse }),
});

const depictEnum: DepictHelper<z.ZodEnum<any> | z.ZodNativeEnum<any>> = ({
  schema: {
    _def: { values },
  },
  initial,
}) => ({
  ...initial,
  type: typeof Object.values(values)[0] as "string" | "number",
  enum: Object.values(values),
});

const depictLiteral: DepictHelper<z.ZodLiteral<any>> = ({
  schema: {
    _def: { value },
  },
  initial,
}) => ({
  ...initial,
  type: typeof value as "string" | "number" | "boolean",
  enum: [value],
});

const depictObject: DepictHelper<z.AnyZodObject> = ({
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
const depictNull: DepictHelper<z.ZodNull> = ({ initial }) => ({
  ...initial,
  type: "string",
  nullable: true,
  format: "null",
});

const depictDate: DepictHelper<z.ZodDate> = ({ initial }) => ({
  ...initial,
  type: "string",
  format: "date",
});

const depictBoolean: DepictHelper<z.ZodBoolean> = ({ initial }) => ({
  ...initial,
  type: "boolean",
});

const depictBigInt: DepictHelper<z.ZodBigInt> = ({ initial }) => ({
  ...initial,
  type: "integer",
  format: "bigint",
});

const depictRecord: DepictHelper<z.ZodRecord<z.ZodTypeAny>> = ({
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

const depictArray: DepictHelper<z.ZodArray<z.ZodTypeAny>> = ({
  schema: { _def: def },
  initial,
  isResponse,
}) => ({
  ...initial,
  type: "array",
  items: depictSchema({ schema: def.type, isResponse }),
  ...(def.minLength ? { minItems: def.minLength.value } : {}),
  ...(def.maxLength ? { maxItems: def.maxLength?.value } : {}),
});

/** @todo improve it when OpenAPI 3.1.0 will be released */
const depictTuple: DepictHelper<z.ZodTuple> = ({
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

const depictString: DepictHelper<z.ZodString> = ({
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

const depictNumber: DepictHelper<z.ZodNumber> = ({ schema, initial }) => {
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

const depictObjectProperties = ({
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

const depictEffect: DepictHelper<z.ZodEffects<z.ZodTypeAny>> = ({
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
        ...depictSchema({ schema: shape[name], isResponse: false }),
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
