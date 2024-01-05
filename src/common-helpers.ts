import { Request } from "express";
import { isHttpError } from "http-errors";
import { createHash } from "node:crypto";
import { z } from "zod";
import { CommonConfig, InputSource, InputSources } from "./config-type";
import { InputValidationError, OutputValidationError } from "./errors";
import { zodFileKind } from "./file-schema";
import { IOSchema } from "./io-schema";
import { AbstractLogger } from "./logger";
import { getMeta, hasMeta } from "./metadata";
import { AuxMethod, Method } from "./method";
import { mimeMultipart } from "./mime";
import { zodUploadKind } from "./upload-schema";

export type FlatObject = Record<string, unknown>;

const areFilesAvailable = (request: Request): boolean => {
  const contentType = request.header("content-type") || "";
  const isMultipart =
    contentType.slice(0, mimeMultipart.length).toLowerCase() === mimeMultipart;
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
export const getCustomHeaders = (request: Request) =>
  Object.entries(request.headers).reduce<FlatObject>(
    (agg, [key, value]) =>
      isCustomHeader(key) ? { ...agg, [key]: value } : agg,
    {},
  );

export const getInput = (
  request: Request,
  inputAssignment: CommonConfig["inputSources"],
) => {
  const method = getActualMethod(request);
  if (method === "options") {
    return {};
  }
  let props = fallbackInputSource;
  if (method in defaultInputSources) {
    props = defaultInputSources[method];
  }
  if (inputAssignment && method in inputAssignment) {
    props = inputAssignment[method] || props;
  }
  return props
    .filter((prop) => (prop === "files" ? areFilesAvailable(request) : true))
    .reduce<FlatObject>(
      (carry, prop) => ({
        ...carry,
        ...(prop === "headers" ? getCustomHeaders(request) : request[prop]),
      }),
      {},
    );
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
): { type: "single"; value: T[] } | { type: "tuple"; value: [T, T][] } => {
  if (a.length === 0) {
    return { type: "single", value: b };
  }
  if (b.length === 0) {
    return { type: "single", value: a };
  }
  const result: [T, T][] = [];
  for (const itemA of a) {
    for (const itemB of b) {
      result.push([itemA, itemB]);
    }
  }
  return { type: "tuple", value: result };
};

const reduceBool = (arr: boolean[]) =>
  arr.reduce((carry, bool) => carry || bool, false);

export const hasTopLevelTransformingEffect = (schema: IOSchema): boolean => {
  if (schema instanceof z.ZodEffects) {
    if (schema._def.effect.type !== "refinement") {
      return true;
    }
  }
  if (schema instanceof z.ZodUnion) {
    return reduceBool(schema.options.map(hasTopLevelTransformingEffect));
  }
  if (schema instanceof z.ZodIntersection) {
    return reduceBool(
      [schema._def.left, schema._def.right].map(hasTopLevelTransformingEffect),
    );
  }
  return false; // ZodObject left
};

export const hasNestedSchema = ({
  subject,
  condition,
  maxDepth,
  depth = 1,
}: {
  subject: z.ZodTypeAny;
  condition: (schema: z.ZodTypeAny) => boolean;
  maxDepth?: number;
  depth?: number;
}): boolean => {
  if (condition(subject)) {
    return true;
  }
  if (maxDepth !== undefined && depth >= maxDepth) {
    return false;
  }
  const common = { condition, maxDepth, depth: depth + 1 };
  if (subject instanceof z.ZodObject) {
    return reduceBool(
      Object.values<z.ZodTypeAny>(subject.shape).map((entry) =>
        hasNestedSchema({ subject: entry, ...common }),
      ),
    );
  }
  if (subject instanceof z.ZodUnion) {
    return reduceBool(
      subject.options.map((entry: z.ZodTypeAny) =>
        hasNestedSchema({ subject: entry, ...common }),
      ),
    );
  }
  if (subject instanceof z.ZodIntersection) {
    return reduceBool(
      [subject._def.left, subject._def.right].map((entry) =>
        hasNestedSchema({ subject: entry, ...common }),
      ),
    );
  }
  if (subject instanceof z.ZodOptional || subject instanceof z.ZodNullable) {
    return hasNestedSchema({ subject: subject.unwrap(), ...common });
  }
  if (subject instanceof z.ZodEffects || subject instanceof z.ZodTransformer) {
    return hasNestedSchema({ subject: subject.innerType(), ...common });
  }
  if (subject instanceof z.ZodRecord) {
    return hasNestedSchema({ subject: subject.valueSchema, ...common });
  }
  if (subject instanceof z.ZodArray) {
    return hasNestedSchema({ subject: subject.element, ...common });
  }
  if (subject instanceof z.ZodDefault) {
    return hasNestedSchema({ subject: subject._def.innerType, ...common });
  }
  return false;
};

export const isProprietary = (schema: z.ZodTypeAny, kind: string) =>
  hasMeta(schema) && getMeta(schema, "proprietaryKind") === kind;

export const hasUpload = (subject: IOSchema) =>
  hasNestedSchema({
    subject,
    condition: (schema) => isProprietary(schema, zodUploadKind),
  });

export const hasRaw = (subject: IOSchema) =>
  hasNestedSchema({
    subject,
    condition: (schema) =>
      isProprietary(schema, zodFileKind) && !(schema instanceof z.ZodString), // @todo can simplify?
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
