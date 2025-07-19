import { Request } from "express";
import createHttpError, { HttpError, isHttpError } from "http-errors";
import * as R from "ramda";
import { z } from "zod";
import type { $ZodObject } from "zod/v4/core";
import { NormalizedResponse, ResponseVariant } from "./api-response";
import {
  combinations,
  FlatObject,
  getMessageFromError,
  isProduction,
} from "./common-helpers";
import { InputValidationError, ResultHandlerError } from "./errors";
import { ActualLogger } from "./logger-helpers";
import { getExamples } from "./metadata";
import type { LazyResult, Result } from "./result-handler";

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

/** @throws ResultHandlerError when Result is an empty array */
export const normalize = <A extends unknown[]>(
  subject: Result | LazyResult<Result, A>,
  {
    variant,
    args,
    ...fallback
  }: Omit<NormalizedResponse, "schema"> & {
    variant: ResponseVariant;
    args: A;
  },
): NormalizedResponse[] => {
  if (typeof subject === "function") subject = subject(...args);
  if (subject instanceof z.ZodType) return [{ schema: subject, ...fallback }];
  if (Array.isArray(subject) && !subject.length) {
    const err = new Error(`At least one ${variant} response schema required.`);
    throw new ResultHandlerError(err);
  }
  return (Array.isArray(subject) ? subject : [subject]).map(
    ({ schema, statusCode, mimeType }) => ({
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
    }),
  );
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
  isProduction() && !error.expose
    ? createHttpError(error.statusCode).message // default message for that code
    : error.message;

/** @see pullRequestExamples */
export const pullResponseExamples = <T extends $ZodObject>(subject: T) =>
  Object.entries(subject._zod.def.shape).reduce<FlatObject[]>(
    (acc, [key, schema]) =>
      combinations(
        acc,
        getExamples(schema).map(R.objOf(key)),
        ([left, right]) => ({
          ...left,
          ...right,
        }),
      ),
    [],
  );
