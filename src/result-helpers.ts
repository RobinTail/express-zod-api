import { Request } from "express";
import { isHttpError } from "http-errors";
import assert from "node:assert/strict";
import { z } from "zod";
import { NormalizedResponse, ResponseVariant } from "./api-response";
import { FlatObject } from "./common-helpers";
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

export const isServerSideIssue = (statusCode: number) =>
  ~~(statusCode / 100) === 5; // 5XX

export const logServerError = ({
  logger,
  request,
  input,
  error,
  statusCode,
}: {
  logger: ActualLogger;
  request: Request;
  input: FlatObject | null;
  error: Error;
  statusCode: number;
}) =>
  isServerSideIssue(statusCode) &&
  logger.error("Server side error", {
    error,
    url: request.url,
    payload: input,
  });

export const getStatusCodeFromError = (error: Error): number => {
  if (isHttpError(error)) return error.statusCode;
  return error instanceof InputValidationError ? 400 : 500;
};
