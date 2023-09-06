import { Request } from "express";
import { HttpError } from "http-errors";
import { createHash } from "node:crypto";
import { Logger } from "winston";
import { z } from "zod";
import {
  CommonConfig,
  InputSource,
  InputSources,
  LoggerConfig,
  loggerLevels,
} from "./config-type";
import { InputValidationError, OutputValidationError } from "./errors";
import { IOSchema } from "./io-schema";
import { getMeta } from "./metadata";
import { AuxMethod, Method } from "./method";
import { mimeMultipart } from "./mime";
import { ZodUpload } from "./upload-schema";

export type FlatObject = Record<string, unknown>;

/** @see https://expressjs.com/en/guide/routing.html */
export const routePathParamsRegex = /:([A-Za-z0-9_]+)/g;

function areFilesAvailable(request: Request) {
  const contentType = request.header("content-type") || "";
  const isMultipart =
    contentType.slice(0, mimeMultipart.length).toLowerCase() === mimeMultipart;
  return "files" in request && isMultipart;
}

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

export function getInput(
  request: Request,
  inputAssignment: CommonConfig["inputSources"],
): Readonly<unknown> {
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
    .reduce(
      (carry, prop) => ({
        ...carry,
        ...request[prop],
      }),
      {},
    );
}

export function isLoggerConfig(logger: unknown): logger is LoggerConfig {
  return (
    typeof logger === "object" &&
    logger !== null &&
    "level" in logger &&
    "color" in logger &&
    typeof logger.level === "string" &&
    Object.keys(loggerLevels).includes(logger.level) &&
    typeof logger.color === "boolean"
  );
}

export function isValidDate(date: Date): boolean {
  return !isNaN(date.getTime());
}

export function makeErrorFromAnything(subject: unknown): Error {
  return subject instanceof Error
    ? subject
    : new Error(
        typeof subject === "symbol" ? subject.toString() : `${subject}`,
      );
}

export function getMessageFromError(error: Error): string {
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
}

export function getStatusCodeFromError(error: Error): number {
  if (error instanceof HttpError) {
    return error.statusCode;
  }
  if (error instanceof InputValidationError) {
    return 400;
  }
  return 500;
}

export const logInternalError = ({
  logger,
  request,
  input,
  error,
  statusCode,
}: {
  logger: Logger;
  request: Request;
  input: unknown;
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

export const combinations = <T extends unknown>(
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

export function getRoutePathParams(path: string): string[] {
  const match = path.match(routePathParamsRegex);
  if (!match) {
    return [];
  }
  return match.map((param) => param.slice(1));
}

const reduceBool = (arr: boolean[]) =>
  arr.reduce((carry, bool) => carry || bool, false);

export function hasTopLevelTransformingEffect(schema: IOSchema): boolean {
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
}

export function hasUpload(schema: z.ZodTypeAny): boolean {
  if (schema instanceof ZodUpload) {
    return true;
  }
  if (schema instanceof z.ZodObject) {
    return reduceBool(Object.values<z.ZodTypeAny>(schema.shape).map(hasUpload));
  }
  if (schema instanceof z.ZodUnion) {
    return reduceBool(schema.options.map(hasUpload));
  }
  if (schema instanceof z.ZodIntersection) {
    return reduceBool([schema._def.left, schema._def.right].map(hasUpload));
  }
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) {
    return hasUpload(schema.unwrap());
  }
  if (schema instanceof z.ZodEffects || schema instanceof z.ZodTransformer) {
    return hasUpload(schema._def.schema);
  }
  if (schema instanceof z.ZodRecord) {
    return hasUpload(schema._def.valueType);
  }
  if (schema instanceof z.ZodArray) {
    return hasUpload(schema._def.type);
  }
  if (schema instanceof z.ZodDefault) {
    return hasUpload(schema._def.innerType);
  }
  return false;
}

/**
 * @desc isNullable() and isOptional() validate the schema's input
 * @desc They always return true in case of coercion, which should be taken into account when depicting response
 */
export const hasCoercion = (schema: z.ZodTypeAny): boolean =>
  "coerce" in schema._def && typeof schema._def.coerce === "boolean"
    ? schema._def.coerce
    : false;

export const makeCleanId = (path: string, method: string, suffix?: string) => {
  return [method]
    .concat(path.split("/"))
    .concat(suffix || [])
    .flatMap((entry) => entry.split(/[^A-Z0-9]/gi))
    .map(
      (entry) => entry.slice(0, 1).toUpperCase() + entry.slice(1).toLowerCase(),
    )
    .join("");
};

export const defaultSerializer = (schema: z.ZodTypeAny): string =>
  createHash("sha1").update(JSON.stringify(schema), "utf8").digest("hex");

export const tryToTransform = <T>({
  effect,
  sample,
}: {
  effect: z.TransformEffect<T>;
  sample: T;
}) => {
  try {
    return typeof effect.transform(sample, {
      addIssue: () => {},
      path: [],
    });
  } catch (e) {
    return undefined;
  }
};

// obtaining the private helper type from Zod
export type ErrMessage = Exclude<
  Parameters<typeof z.ZodString.prototype.email>[0],
  undefined
>;

// the copy of the private Zod errorUtil.errToObj
export const errToObj = (message: ErrMessage | undefined) =>
  typeof message === "string" ? { message } : message || {};
