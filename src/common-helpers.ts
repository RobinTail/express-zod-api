import { Request } from "express";
import { HttpError } from "http-errors";
import { z } from "zod";
import {
  CommonConfig,
  InputSources,
  LoggerConfig,
  loggerLevels,
} from "./config-type";
import { copyMeta, getMeta } from "./metadata";
import { Method } from "./method";
import { AnyMiddlewareDef } from "./middleware";
import { mimeMultipart } from "./mime";
import { ZodUpload } from "./upload-schema";

export type FlatObject = Record<string, any>;

export type IOSchema<U extends UnknownKeysParam = any> =
  | z.ZodObject<any, U>
  | z.ZodUnion<[IOSchema<U>, ...IOSchema<U>[]]>
  | z.ZodIntersection<IOSchema<U>, IOSchema<U>>
  | z.ZodDiscriminatedUnion<string, z.Primitive, z.ZodObject<any, U>>;

export type ArrayElement<T extends readonly unknown[]> =
  T extends readonly (infer K)[] ? K : never;

export type OutputMarker = IOSchema & { _typeGuard: "OutputMarker" };
export const markOutput = (output: IOSchema) => output as OutputMarker;

/** @see https://expressjs.com/en/guide/routing.html */
export const routePathParamsRegex = /:([A-Za-z0-9_]+)/g;

export type ReplaceMarkerInShape<
  S extends z.ZodRawShape,
  OUT extends IOSchema
> = {
  [K in keyof S]: S[K] extends OutputMarker ? OUT : S[K];
};

export type ProbableIntersection<
  A extends IOSchema<"strip"> | null,
  B extends IOSchema
> = A extends null
  ? B
  : A extends IOSchema<"strip">
  ? z.ZodIntersection<A, B>
  : never;

/**
 * @description intersects input schemas of middlewares and the endpoint
 * @since 07.03.2022 former combineEndpointAndMiddlewareInputSchemas()
 */
export const getFinalEndpointInputSchema = <
  MIN extends IOSchema<"strip"> | null,
  IN extends IOSchema
>(
  middlewares: AnyMiddlewareDef[],
  input: IN
): ProbableIntersection<MIN, IN> => {
  const result = middlewares
    .map(({ input: schema }) => schema)
    .concat(input)
    .reduce((acc, schema) => acc.and(schema)) as ProbableIntersection<MIN, IN>;
  for (const middleware of middlewares) {
    copyMeta(middleware.input, result);
  }
  copyMeta(input, result);
  return result;
};

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
  delete: ["body", "query", "params"],
};
const fallbackInputSource = defaultInputSources.delete;

export function getInitialInput(
  request: Request,
  inputAssignment: CommonConfig["inputSources"]
): any {
  const method = request.method.toLowerCase() as Method;
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

export function getMessageFromError(error: Error): string {
  if (error instanceof z.ZodError) {
    return error.issues
      .map(({ path, message }) => `${path.join("/")}: ${message}`)
      .join("; ");
  }
  return error.message;
}

export function getStatusCodeFromError(error: Error): number {
  if (error instanceof HttpError) {
    return error.statusCode;
  }
  if (error instanceof z.ZodError) {
    return 400;
  }
  return 500;
}

type Examples<T extends z.ZodTypeAny> = Readonly<z.input<T>[] | z.output<T>[]>;
export const getExamples = <T extends z.ZodTypeAny>(
  schema: T,
  parseToOutput: boolean
): Examples<T> => {
  const examples = getMeta(schema, "examples");
  if (examples === undefined) {
    return [];
  }
  return examples.reduce((carry, example) => {
    const parsedExample = schema.safeParse(example);
    return carry.concat(
      parsedExample.success
        ? parseToOutput
          ? parsedExample.data
          : example
        : []
    );
  }, [] as z.output<typeof schema>[]);
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

export function hasUpload(schema: z.ZodTypeAny): boolean {
  if (schema instanceof ZodUpload) {
    return true;
  }
  const reduceBool = (arr: boolean[]) =>
    arr.reduce((carry, check) => carry || check, false);
  if (schema instanceof z.ZodObject) {
    return reduceBool(Object.values<z.ZodTypeAny>(schema.shape).map(hasUpload));
  }
  if (schema instanceof z.ZodUnion) {
    return reduceBool(schema._def.options.map(hasUpload));
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

// obtaining the private helper type from Zod
export type ErrMessage = Exclude<
  Parameters<typeof z.ZodString.prototype.email>[0],
  undefined
>;

// the copy of the private Zod errorUtil.errToObj
export const errToObj = (message: ErrMessage | undefined) =>
  typeof message === "string" ? { message } : message || {};

// the copy of the private Zod utility type of ZodObject
type UnknownKeysParam = "passthrough" | "strict" | "strip";
