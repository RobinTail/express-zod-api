import { Request } from "express";
import createHttpError, { HttpError, isHttpError } from "http-errors";
import assert from "node:assert/strict";
import { memoizeWith } from "ramda";
import { z } from "zod";
import { NormalizedResponse, ResponseVariant } from "./api-response";
import { FlatObject, getMessageFromError } from "./common-helpers";
import { CommonConfig } from "./config-type";
import { InputValidationError, ResultHandlerError } from "./errors";
import { ActualLogger } from "./logger-helpers";
import type { LazyResult, Result } from "./result-handler";

export type ResultSchema<R extends Result> =
  R extends Result<infer S> ? S : never;

/** @throws ResultHandlerError when Result is an empty array */
export const normalize = <A extends unknown[]>(
  subject: Result | LazyResult<Result, A>,
  features: {
    variant: ResponseVariant;
    arguments: A;
    statusCodes: [number, ...number[]];
    mimeTypes: [string, ...string[]];
  },
): NormalizedResponse[] => {
  if (typeof subject === "function") {
    return normalize(subject(...features.arguments), features);
  }
  if (subject instanceof z.ZodType) {
    return [{ ...features, schema: subject }];
  }
  if (Array.isArray(subject)) {
    assert(
      subject.length,
      new ResultHandlerError(
        new Error(`At least one ${features.variant} response schema required.`),
      ),
    );
  }
  return (Array.isArray(subject) ? subject : [subject]).map(
    ({ schema, statusCodes, statusCode, mimeTypes, mimeType }) => ({
      schema,
      statusCodes: statusCode
        ? [statusCode]
        : statusCodes || features.statusCodes,
      mimeTypes: mimeType ? [mimeType] : mimeTypes || features.mimeTypes,
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
export const ensureHttpError = (
  error: Error,
  getStatusCode: CommonConfig["getStatusCode"] = () =>
    error instanceof InputValidationError ? 400 : 500,
): HttpError => {
  if (isHttpError(error)) return error;
  return createHttpError(getStatusCode(error), getMessageFromError(error), {
    cause: error.cause || error,
  });
};

const isProduction = memoizeWith(
  () => process.env.TSUP_STATIC as string, // dynamic in tests, but static in build
  () => process.env.NODE_ENV === "production",
);

export const getPublicErrorMessage = (error: HttpError): string =>
  isProduction() && !error.expose
    ? createHttpError(error.statusCode).message // default message for that code
    : error.message;
