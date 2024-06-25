import { Request } from "express";
import { isHttpError } from "http-errors";
import { createHash } from "node:crypto";
import { flip, pickBy, xprod } from "ramda";
import { z } from "zod";
import { CommonConfig, InputSource, InputSources } from "./config-type";
import { InputValidationError, OutputValidationError } from "./errors";
import { ActualLogger } from "./logger-helpers";
import { metaSymbol } from "./metadata";
import { AuxMethod, Method } from "./method";
import { contentTypes } from "./content-type";

/** @desc this type does not allow props assignment, but it works for reading them when merged with another interface */
export type EmptyObject = Record<string, never>;
export type FlatObject = Record<string, unknown>;

const areFilesAvailable = (request: Request): boolean => {
  const contentType = request.header("content-type") || "";
  const isUpload = contentType.toLowerCase().startsWith(contentTypes.upload);
  return "files" in request && isUpload;
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
  logger: ActualLogger;
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
  const examples = schema._def[metaSymbol]?.examples || [];
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
  } catch {
    return undefined;
  }
};

/** @desc can still be an array, use R.complement(Array.isArray) to exclude that case */
export const isObject = (subject: unknown) =>
  typeof subject === "object" && subject !== null;
