import { Request } from "express";
import { HttpError } from "http-errors";
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

export type FlatObject = Record<string, any>;

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
  inputAssignment: CommonConfig["inputSources"]
): any {
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
      {}
    );
}

export function isLoggerConfig(logger: any): logger is LoggerConfig {
  return (
    typeof logger === "object" &&
    "level" in logger &&
    "color" in logger &&
    Object.keys(loggerLevels).includes(logger.level) &&
    typeof logger.color === "boolean"
  );
}

export function isValidDate(date: Date): boolean {
  return !isNaN(date.getTime());
}

export function makeErrorFromAnything<T extends Error>(subject: T): T;
export function makeErrorFromAnything(subject: any): Error;
export function makeErrorFromAnything<T>(subject: T): Error {
  return subject instanceof Error
    ? subject
    : new Error(
        typeof subject === "symbol" ? subject.toString() : `${subject}`
      );
}

export function getMessageFromError(error: Error): string {
  if (error instanceof z.ZodError) {
    return error.issues
      .map(({ path, message }) =>
        (path.length ? [path.join("/")] : []).concat(message).join(": ")
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

export const getExamples = <T extends z.ZodTypeAny, V extends boolean>(
  schema: T,
  isParsed: V // This does not control parsing — it happens anyway
): ReadonlyArray<V extends true ? z.output<T> : z.input<T>> => {
  const result: Array<z.input<T> | z.output<T>> = [];
  const examples = getMeta(schema, "examples");
  for (const example of examples || []) {
    const parsedExample = schema.safeParse(example); // I parse anyway in order to filter out invalid examples
    if (parsedExample.success) {
      result.push(isParsed ? parsedExample.data : example);
    }
  }
  return result;
};

export const combinations = <T extends any>(
  a: T[],
  b: T[]
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
      [schema._def.left, schema._def.right].map(hasTopLevelTransformingEffect)
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
      (entry) => entry.slice(0, 1).toUpperCase() + entry.slice(1).toLowerCase()
    )
    .join("");
};

export const tryToTransform = ({
  effect,
  sample,
}: {
  effect: z.Effect<any> & { type: "transform" };
  sample: any;
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
