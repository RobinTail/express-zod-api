import { Request } from "express";
import createHttpError, { HttpError, isHttpError } from "http-errors";
import { z } from "zod";
import { NormalizedResponse, ResponseVariant } from "./api-response";
import {
  FlatObject,
  getMessageFromError,
  isProduction,
} from "./common-helpers";
import { InputValidationError, ResultHandlerError } from "./errors";
import { ActualLogger } from "./logger-helpers";
import type { LazyResult, Result } from "./result-handler";

export type ResultSchema<R extends Result> =
  R extends Result<infer S> ? S : never;

/** @throws ResultHandlerError when Result is an empty array */
export const normalize = <A extends unknown[]>(
  subject: Result | LazyResult<Result, A>,
  features: Omit<NormalizedResponse, "schema"> & {
    variant: ResponseVariant;
    arguments: A;
  },
): NormalizedResponse[] => {
  if (typeof subject === "function")
    return normalize(subject(...features.arguments), features);
  if (subject instanceof z.ZodType) {
    return [
      {
        schema: subject,
        mimeTypes: features.mimeTypes,
        statusCodes: features.statusCodes,
      },
    ];
  }
  if (Array.isArray(subject) && !subject.length) {
    throw new ResultHandlerError(
      new Error(`At least one ${features.variant} response schema required.`),
    );
  }
  return (Array.isArray(subject) ? subject : [subject]).map(
    ({ schema, statusCode, mimeType }) => ({
      schema,
      statusCodes:
        typeof statusCode === "number"
          ? [statusCode]
          : statusCode || features.statusCodes,
      mimeTypes:
        typeof mimeType === "string"
          ? [mimeType]
          : mimeType || features.mimeTypes,
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
