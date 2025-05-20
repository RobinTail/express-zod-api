import type { $ZodObject, $ZodTransform, $ZodType } from "zod/v4/core";
import { Request } from "express";
import * as R from "ramda";
import { globalRegistry, z } from "zod/v4";
import { CommonConfig, InputSource, InputSources } from "./config-type";
import { contentTypes } from "./content-type";
import { OutputValidationError } from "./errors";
import { AuxMethod, Method } from "./method";

/** @desc this type does not allow props assignment, but it works for reading them when merged with another interface */
export type EmptyObject = z.output<EmptySchema>;
export type EmptySchema = z.ZodRecord<z.ZodString, z.ZodNever>;
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

/** @see https://expressjs.com/en/guide/routing.html */
export const routePathParamsRegex = /:([A-Za-z0-9_]+)/g;
export const getRoutePathParams = (path: string): string[] =>
  path.match(routePathParamsRegex)?.map((param) => param.slice(1)) || [];

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
  subject instanceof Error
    ? subject
    : subject instanceof z.ZodError
      ? new Error(getMessageFromError(subject), { cause: subject })
      : new Error(String(subject));

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

/** Faster replacement to instanceof for code operating core types (traversing schemas) */
export const isSchema = <T extends $ZodType>(
  subject: $ZodType,
  type: T["_zod"]["def"]["type"],
): subject is T => subject._zod.def.type === type;

/** Takes the original unvalidated examples from the properties of ZodObject schema shape */
export const pullExampleProps = <T extends $ZodObject>(subject: T) =>
  Object.entries(subject._zod.def.shape).reduce<Partial<z.input<T>>[]>(
    (acc, [key, schema]) => {
      const { examples = [] } = globalRegistry.get(schema) || {};
      return combinations(acc, examples.map(R.objOf(key)), ([left, right]) => ({
        ...left,
        ...right,
      }));
    },
    [],
  );

export const combinations = <T>(
  a: T[],
  b: T[],
  merge: (pair: [T, T]) => T,
): T[] => (a.length && b.length ? R.xprod(a, b).map(merge) : a.concat(b));

export const ucFirst = (subject: string) =>
  subject.charAt(0).toUpperCase() + subject.slice(1).toLowerCase();

export const makeCleanId = (...args: string[]) => {
  const byAlpha = R.chain((entry) => entry.split(/[^A-Z0-9]/gi), args);
  const byWord = R.chain(
    (entry) =>
      entry.replaceAll(/[A-Z]+/g, (beginning) => `/${beginning}`).split("/"),
    byAlpha,
  );
  return byWord.map(ucFirst).join("");
};

export const getTransformedType = R.tryCatch(
  <T>(schema: $ZodTransform<unknown, T>, sample: T) =>
    typeof z.parse(schema, sample),
  R.always(undefined),
);

export const isOptional = (
  { _zod: { optin, optout } }: $ZodType,
  { isResponse }: { isResponse: boolean },
) => (isResponse ? optout : optin) === "optional";

/** @desc can still be an array, use Array.isArray() or rather R.type() to exclude that case */
export const isObject = (subject: unknown) =>
  typeof subject === "object" && subject !== null;

export const isProduction = R.memoizeWith(
  () => process.env.TSUP_STATIC as string, // eslint-disable-line no-restricted-syntax -- substituted by TSUP
  () => process.env.NODE_ENV === "production", // eslint-disable-line no-restricted-syntax -- memoized
);
