import type { Request } from "express";
import createHttpError, { HttpError, isHttpError } from "http-errors";
import * as R from "ramda";
import { z } from "zod";
import {
  defaultStatusCodes,
  isPositiveStatusCode,
  type NormalizedResponse,
  type ResponseVariant,
} from "./api-response";
import {
  combinations,
  getMessageFromError,
  runtime,
  type FlatObject,
} from "./common-helpers";
import { InputValidationError, ResultHandlerError } from "./errors";
import type { ActualLogger } from "./logger-helpers";
import type { LazyResult, Result } from "./result-handler";
import { getExamples } from "./metadata";
import { contentTypes } from "./content-type";

export type ResultSchema<R extends Result> =
  R extends Result<infer S> ? S : never;

export type DiscriminatedResult =
  | {
      output: FlatObject;
      error: null;
    }
  | {
      output: null;
      error: Error;
    };

/** @throws ResultHandlerError when Result is an empty array or contains duplicate status codes */
export const normalize = <A extends unknown[]>(
  subject: Result | LazyResult<Result, A>,
  { variant, args }: { variant: ResponseVariant; args: A },
): NormalizedResponse[] => {
  if (typeof subject === "function") subject = subject(...args);
  const fallback: Pick<NormalizedResponse, "statusCodes" | "mimeTypes"> = {
    statusCodes: [defaultStatusCodes[variant]],
    mimeTypes: [contentTypes.json],
  };
  if (subject instanceof z.ZodType) return [{ schema: subject, ...fallback }];
  if (Array.isArray(subject) && !subject.length) {
    const err = new Error(`At least one ${variant} response schema required.`);
    throw new ResultHandlerError(err);
  }
  const normalized = (
    Array.isArray(subject) ? subject : [subject]
  ).map<NormalizedResponse>(({ schema, statusCode, mimeType }) => ({
    schema,
    statusCodes:
      typeof statusCode === "number"
        ? [statusCode]
        : statusCode || fallback.statusCodes,
    mimeTypes:
      typeof mimeType === "string"
        ? [mimeType]
        : mimeType === undefined
          ? fallback.mimeTypes
          : mimeType,
  }));
  const statusCodes = R.chain(R.prop("statusCodes"), normalized);
  const invalid = statusCodes.find(
    (one) => isPositiveStatusCode(one) === (variant === "negative"),
  );
  if (invalid !== undefined) {
    const err = new Error(
      `The status code ${invalid} is not valid for a ${variant} API response.`,
    );
    throw new ResultHandlerError(err);
  }
  if (normalized.length > 1) {
    const duplicated = R.find(
      (code) => statusCodes.indexOf(code) !== statusCodes.lastIndexOf(code),
      statusCodes,
    );
    if (duplicated !== undefined) {
      const err = new Error(
        `The status code ${duplicated} is used by multiple response schemas.`,
      );
      throw new ResultHandlerError(err);
    }
  }
  return normalized;
};

/** @internal An internal helper applying the Endpoint-declared status codes to the normalized responses. */
export const overrideStatusCodes = (
  responses: NormalizedResponse[],
  declared: ReadonlySet<number>,
  variant: ResponseVariant,
): NormalizedResponse[] => {
  const narrowed = Array.from(declared).filter(
    (one) => isPositiveStatusCode(one) === (variant === "positive"),
  );
  if (!narrowed.length) return responses;
  if (responses.length === 1) {
    const response = responses[0]!; // ensured by the length check
    return [{ ...response, statusCodes: narrowed as [number, ...number[]] }];
  }
  const matched: NormalizedResponse[] = responses
    .map(({ schema, mimeTypes, statusCodes }) => ({
      schema,
      mimeTypes,
      statusCodes: statusCodes.filter((statusCode) =>
        narrowed.includes(statusCode),
      ) as [number, ...number[]],
    }))
    .filter(({ statusCodes }) => statusCodes.length > 0);
  const covered = new Set(R.chain(({ statusCodes }) => statusCodes, matched));
  const uncovered = narrowed.filter((statusCode) => !covered.has(statusCode));
  if (uncovered.length) {
    throw new ResultHandlerError(
      new Error(
        `Endpoint declares status code${uncovered.length > 1 ? "s" : ""} ` +
          `${uncovered.join(", ")} for its ${variant} responses, but the ResultHandler ` +
          `defines response schema${responses.length > 1 ? "s" : ""} only for the status code` +
          `${responses.length > 1 ? "s" : ""} ` +
          `${R.chain(({ statusCodes }) => statusCodes, responses).join(", ")}.`,
      ),
    );
  }
  return matched;
};

export const logServerError = (
  error: HttpError,
  logger: ActualLogger,
  { url }: Request,
  payload: FlatObject | null,
) =>
  !error.expose && logger.error("Server side error", { error, url, payload });

/**
 * @example InputValidationError —> BadRequest(400)
 * @example Error —> InternalServerError(500)
 * */
export const ensureHttpError = (error: Error): HttpError => {
  if (isHttpError(error)) return error;
  return createHttpError(
    error instanceof InputValidationError ? 400 : 500,
    getMessageFromError(error),
    { cause: error.cause || error },
  );
};

export const getPublicErrorMessage = (error: HttpError): string =>
  runtime.isProduction && !error.expose
    ? createHttpError(error.statusCode).message // default message for that code
    : error.message;

/** @see pullRequestExamples */
export const pullResponseExamples = <T extends z.core.$ZodObject>(subject: T) =>
  Object.entries(subject._zod.def.shape).reduce<FlatObject[]>(
    (acc, [key, schema]) =>
      combinations(
        acc,
        getExamples(schema).map(R.objOf(key)),
        ([left, right]) => ({ ...left, ...right }),
      ),
    [],
  );
