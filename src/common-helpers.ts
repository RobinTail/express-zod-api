import { Request } from "express";
import { isHttpError } from "http-errors";
import { createHash } from "node:crypto";
import { flip, pickBy, xprod } from "ramda";
import { z } from "zod";
import { CommonConfig, InputSource, InputSources } from "./config-type";
import { InputValidationError, OutputValidationError } from "./errors";
import { IOSchema } from "./io-schema";
import { AbstractLogger } from "./logger";
import { getMeta, isProprietary } from "./metadata";
import { AuxMethod, Method } from "./method";
import { mimeMultipart } from "./mime";
import { ezRawKind } from "./raw-schema";
import { SchemaHandler, walkSchema } from "./schema-walker";
import { ezUploadKind } from "./upload-schema";

export type FlatObject = Record<string, unknown>;

const areFilesAvailable = (request: Request): boolean => {
  const contentType = request.header("content-type") || "";
  const isMultipart = contentType.toLowerCase().startsWith(mimeMultipart);
  return "files" in request && isMultipart;
};

export const defaultInputSources: InputSources = {
  get: ["query", "params"],
  post: ["body", "params", "files"],
  put: ["body", "params"],
  patch: ["body", "params"],
  delete: ["query", "params"],
};
const fallbackInputSource: InputSource[] = ["body", "query", "params"];

export const getActualMethod = (request: Request) =>
  request.method.toLowerCase() as Method | AuxMethod;

export const isCustomHeader = (name: string): name is `x-${string}` =>
  name.startsWith("x-");

/** @see https://nodejs.org/api/http.html#messageheaders */
export const getCustomHeaders = (headers: FlatObject): FlatObject =>
  pickBy(flip(isCustomHeader), headers); // needs flip to address the keys

export const getInput = (
  req: Request,
  userDefined: CommonConfig["inputSources"] = {},
): FlatObject => {
  const method = getActualMethod(req);
  if (method === "options") {
    return {};
  }
  return (
    userDefined[method] ||
    defaultInputSources[method] ||
    fallbackInputSource
  )
    .filter((src) => (src === "files" ? areFilesAvailable(req) : true))
    .map((src) => (src === "headers" ? getCustomHeaders(req[src]) : req[src]))
    .reduce<FlatObject>((agg, obj) => ({ ...agg, ...obj }), {});
};

export const makeErrorFromAnything = (subject: unknown): Error =>
  subject instanceof Error
    ? subject
    : new Error(
        typeof subject === "symbol" ? subject.toString() : `${subject}`,
      );

export const getMessageFromError = (error: Error): string => {
  if (error instanceof z.ZodError) {
    return error.issues
      .map(({ path, message }) =>
        (path.length ? [path.join("/")] : []).concat(message).join(": "),
      )
      .join("; ");
  }
  if (error instanceof OutputValidationError) {
    const hasFirstField = error.originalError.issues[0]?.path.length > 0;
    return `output${hasFirstField ? "/" : ": "}${error.message}`;
  }
  return error.message;
};

export const getStatusCodeFromError = (error: Error): number => {
  if (isHttpError(error)) {
    return error.statusCode;
  }
  if (error instanceof InputValidationError) {
    return 400;
  }
  return 500;
};

export const logInternalError = ({
  logger,
  request,
  input,
  error,
  statusCode,
}: {
  logger: AbstractLogger;
  request: Request;
  input: FlatObject | null;
  error: Error;
  statusCode: number;
}) => {
  if (statusCode === 500) {
    logger.error(`Internal server error\n${error.stack}\n`, {
      url: request.url,
      payload: input,
    });
  }
};

export const getExamples = <
  T extends z.ZodTypeAny,
  V extends "original" | "parsed" | undefined,
>({
  schema,
  variant = "original",
  validate = variant === "parsed",
}: {
  schema: T;
  /**
   * @desc examples variant: original or parsed
   * @example "parsed" — for the case when possible schema transformations should be applied
   * @default "original"
   * @override validate: variant "parsed" activates validation as well
   * */
  variant?: V;
  /**
   * @desc filters out the examples that do not match the schema
   * @default variant === "parsed"
   * */
  validate?: boolean;
}): ReadonlyArray<V extends "parsed" ? z.output<T> : z.input<T>> => {
  const examples = getMeta(schema, "examples") || [];
  if (!validate && variant === "original") {
    return examples;
  }
  const result: Array<z.input<T> | z.output<T>> = [];
  for (const example of examples) {
    const parsedExample = schema.safeParse(example);
    if (parsedExample.success) {
      result.push(variant === "parsed" ? parsedExample.data : example);
    }
  }
  return result;
};

export const combinations = <T>(
  a: T[],
  b: T[],
  merge: (pair: [T, T]) => T,
): T[] => (a.length && b.length ? xprod(a, b).map(merge) : a.concat(b));

type Check<T extends z.ZodTypeAny> = SchemaHandler<T, boolean>;
export const hasTopLevelTransformingEffect = (subject: IOSchema): boolean => {
  const onEffects: Check<z.ZodEffects<z.ZodTypeAny>> = ({ schema }) =>
    schema._def.effect.type !== "refinement";
  const onUnion: Check<z.ZodUnion<z.ZodUnionOptions>> = ({ schema, next }) =>
    schema.options.some((opt) => next({ schema: opt }));
  const onIntersection: Check<
    z.ZodIntersection<z.ZodTypeAny, z.ZodTypeAny>
  > = ({ schema, next }) =>
    [schema._def.left, schema._def.right].some((side) =>
      next({ schema: side }),
    );
  return walkSchema({
    schema: subject,
    rules: {
      ZodEffects: onEffects,
      ZodUnion: onUnion,
      ZodIntersection: onIntersection,
    },
    onMissing: () => false,
  });
};

export const hasNestedSchema = ({
  subject,
  condition,
  maxDepth,
}: {
  subject: z.ZodTypeAny;
  condition: (schema: z.ZodTypeAny) => boolean;
  maxDepth?: number;
}): boolean => {
  const onObject: Check<z.ZodObject<z.ZodRawShape>> = ({ schema, next }) =>
    Object.values(schema.shape).some((entry) => next({ schema: entry }));
  const onUnion: Check<
    | z.ZodUnion<z.ZodUnionOptions>
    | z.ZodDiscriminatedUnion<string, z.ZodDiscriminatedUnionOption<string>[]>
  > = ({ schema, next }) =>
    schema.options.some((entry) => next({ schema: entry }));
  const onIntersection: Check<
    z.ZodIntersection<z.ZodTypeAny, z.ZodTypeAny>
  > = ({ schema, next }) =>
    [schema._def.left, schema._def.right].some((entry) =>
      next({ schema: entry }),
    );
  const onOptional: Check<
    z.ZodOptional<z.ZodTypeAny> | z.ZodNullable<z.ZodTypeAny>
  > = ({ schema, next }) => next({ schema: schema.unwrap() });
  const onEffects: Check<z.ZodEffects<z.ZodTypeAny>> = ({ schema, next }) =>
    next({ schema: schema.innerType() });
  const onRecord: Check<z.ZodRecord> = ({ schema, next }) =>
    next({ schema: schema.valueSchema });
  const onArray: Check<z.ZodArray<z.ZodTypeAny>> = ({ schema, next }) =>
    next({ schema: schema.element });
  const onDefault: Check<z.ZodDefault<z.ZodTypeAny>> = ({ schema, next }) =>
    next({ schema: schema._def.innerType });
  return walkSchema({
    schema: subject,
    onMissing: () => false,
    onEach: ({ schema }) => condition(schema),
    maxDepth,
    rules: {
      ZodObject: onObject,
      ZodUnion: onUnion,
      ZodDiscriminatedUnion: onUnion,
      ZodIntersection: onIntersection,
      ZodOptional: onOptional,
      ZodNullable: onOptional,
      ZodEffects: onEffects,
      ZodRecord: onRecord,
      ZodArray: onArray,
      ZodDefault: onDefault,
    },
  });
};

export const hasUpload = (subject: IOSchema) =>
  hasNestedSchema({
    subject,
    condition: (schema) => isProprietary(schema, ezUploadKind),
  });

export const hasRaw = (subject: IOSchema) =>
  hasNestedSchema({
    subject,
    condition: (schema) => isProprietary(schema, ezRawKind),
    maxDepth: 3,
  });

/**
 * @desc isNullable() and isOptional() validate the schema's input
 * @desc They always return true in case of coercion, which should be taken into account when depicting response
 */
export const hasCoercion = (schema: z.ZodTypeAny): boolean =>
  "coerce" in schema._def && typeof schema._def.coerce === "boolean"
    ? schema._def.coerce
    : false;

export const ucFirst = (subject: string) =>
  subject.charAt(0).toUpperCase() + subject.slice(1).toLowerCase();

export const makeCleanId = (...args: string[]) =>
  args
    .flatMap((entry) => entry.split(/[^A-Z0-9]/gi)) // split by non-alphanumeric characters
    .flatMap((entry) =>
      // split by sequences of capitalized letters
      entry.replaceAll(/[A-Z]+/g, (beginning) => `/${beginning}`).split("/"),
    )
    .map(ucFirst)
    .join("");

export const defaultSerializer = (schema: z.ZodTypeAny): string =>
  createHash("sha1").update(JSON.stringify(schema), "utf8").digest("hex");

export const tryToTransform = <T>(
  schema: z.ZodEffects<z.ZodTypeAny, T>,
  sample: T,
) => {
  try {
    return typeof schema.parse(sample);
  } catch (e) {
    return undefined;
  }
};
