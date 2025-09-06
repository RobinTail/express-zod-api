import { Request } from "express";
import createHttpError, { HttpError, isHttpError } from "http-errors";
import * as R from "ramda";
import { globalRegistry, z } from "zod";
import {
  combinations,
  FlatObject,
  getMessageFromError,
  isProduction,
} from "./common-helpers";
import { InputValidationError } from "./errors";
import { ActualLogger } from "./logger-helpers";
import type { Result } from "./result-handler";

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
export const pullResponseExamples = <T extends z.core.$ZodObject>(subject: T) =>
  Object.entries(subject._zod.def.shape).reduce<FlatObject[]>(
    (acc, [key, schema]) => {
      const { examples = [] } = globalRegistry.get(schema) || {};
      return combinations(acc, examples.map(R.objOf(key)), ([left, right]) => ({
        ...left,
        ...right,
      }));
    },
    [],
  );
