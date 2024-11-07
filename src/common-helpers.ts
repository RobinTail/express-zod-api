import { Request } from "express";
import { memoizeWith, pickBy, xprod } from "ramda";
import { z } from "zod";
import { CommonConfig, InputSource, InputSources } from "./config-type";
import { contentTypes } from "./content-type";
import { OutputValidationError } from "./errors";
import { metaSymbol } from "./metadata";
import { AuxMethod, Method } from "./method";

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
  pickBy((_, key) => isCustomHeader(key), headers); // twice faster than flip()

export const getInput = (
  req: Request,
  userDefined: CommonConfig["inputSources"] = {},
): FlatObject => {
  const method = getActualMethod(req);
  if (method === "options") return {};
  return (
    userDefined[method] ||
    defaultInputSources[method] ||
    fallbackInputSource
  )
    .filter((src) => (src === "files" ? areFilesAvailable(req) : true))
    .map((src) => (src === "headers" ? getCustomHeaders(req[src]) : req[src]))
    .reduce<FlatObject>((agg, obj) => ({ ...agg, ...obj }), {});
};

export const ensureError = (subject: unknown): Error =>
  subject instanceof Error ? subject : new Error(String(subject));

export const getMessageFromError = (error: Error): string => {
  if (error instanceof z.ZodError) {
    return error.issues
      .map(({ path, message }) =>
        (path.length ? [path.join("/")] : []).concat(message).join(": "),
      )
      .join("; ");
  }
  if (error instanceof OutputValidationError) {
    const hasFirstField = error.cause.issues[0]?.path.length > 0;
    return `output${hasFirstField ? "/" : ": "}${error.message}`;
  }
  return error.message;
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
  if (!validate && variant === "original") return examples;
  const result: Array<z.input<T> | z.output<T>> = [];
  for (const example of examples) {
    const parsedExample = schema.safeParse(example);
    if (parsedExample.success)
      result.push(variant === "parsed" ? parsedExample.data : example);
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

/** @desc can still be an array, use Array.isArray() or rather R.type() to exclude that case */
export const isObject = (subject: unknown) =>
  typeof subject === "object" && subject !== null;

export const isProduction = memoizeWith(
  () => process.env.TSUP_STATIC as string, // dynamic in tests, but static in build
  () => process.env.NODE_ENV === "production",
);
