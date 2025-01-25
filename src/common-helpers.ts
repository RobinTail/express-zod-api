import { Request } from "express";
import { chain, memoizeWith, xprod } from "ramda";
import { z } from "zod";
import { CommonConfig, InputSource, InputSources } from "./config-type";
import { contentTypes } from "./content-type";
import { OutputValidationError } from "./errors";
import { copyMeta, metaSymbol } from "./metadata";
import { AuxMethod, Method } from "./method";

/** @desc this type does not allow props assignment, but it works for reading them when merged with another interface */
export type EmptyObject = Record<string, never>;
export type EmptySchema = z.ZodObject<EmptyObject, "strip">;
export type FlatObject = Record<string, unknown>;

/** @link https://stackoverflow.com/a/65492934 */
type NoNever<T, F> = [T] extends [never] ? F : T;

/**
 * @desc Using module augmentation approach you can specify tags as the keys of this interface
 * @example declare module "express-zod-api" { interface TagOverrides { users: unknown } }
 * @link https://www.typescriptlang.org/docs/handbook/declaration-merging.html#module-augmentation
 * */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- augmentation
export interface TagOverrides {}
export type Tag = NoNever<keyof TagOverrides, string>;

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
    .reduce<FlatObject>((agg, src) => Object.assign(agg, req[src]), {});
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

/** Takes the original unvalidated examples from the properties of ZodObject schema shape */
const pullExampleProps = <T extends z.SomeZodObject>(subject: T): T =>
  Object.entries(subject.shape).reduce((acc, [key, schema]) => {
    const examples = getExamples({
      schema,
      variant: "original",
      pullProps: false,
    });
    const asObject = examples.reduce<z.SomeZodObject>(
      (tmp, example) => tmp.example({ [key]: example }),
      z.object({ [key]: schema }),
    );
    return copyMeta(asObject, acc);
  }, subject);

export const getExamples = <
  T extends z.ZodTypeAny,
  V extends "original" | "parsed" | undefined,
>({
  schema,
  variant = "original",
  validate = variant === "parsed",
  pullProps = true,
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
  /**
   * @desc should pull examples from properties — applicable to ZodObject only
   * @default true
   * */
  pullProps?: boolean;
}): ReadonlyArray<V extends "parsed" ? z.output<T> : z.input<T>> => {
  const examples = schema._def[metaSymbol]?.examples || [];
  if (!examples.length && pullProps && schema instanceof z.ZodObject) {
    return getExamples({
      schema: pullExampleProps(schema),
      pullProps: false, // avoid loop
      variant,
      validate,
    });
  }
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

export const makeCleanId = (...args: string[]) => {
  const byAlpha = chain((entry) => entry.split(/[^A-Z0-9]/gi), args);
  const byWord = chain(
    (entry) =>
      entry.replaceAll(/[A-Z]+/g, (beginning) => `/${beginning}`).split("/"),
    byAlpha,
  );
  return byWord.map(ucFirst).join("");
};

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
  () => process.env.TSUP_STATIC as string, // eslint-disable-line no-restricted-syntax -- substituted by TSUP
  () => process.env.NODE_ENV === "production", // eslint-disable-line no-restricted-syntax -- memoized
);
