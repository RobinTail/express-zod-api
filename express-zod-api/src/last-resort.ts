import type { Response } from "express";
import createHttpError, { isHttpError } from "http-errors";
import type { ResultHandlerError } from "./errors.ts";
import type { ActualLogger } from "./logger-helpers.ts";
import { getPublicErrorMessage } from "./result-helpers.ts";

interface LastResortHandlerParams {
  error: ResultHandlerError;
  logger: ActualLogger;
  response: Response;
}

export const lastResortHandler = ({
  error,
  logger,
  response,
}: LastResortHandlerParams) => {
  logger.error("Result handler failure", error);
  const message = getPublicErrorMessage(
    createHttpError(
      500,
      `An error occurred while serving the result: ${error.message}.` +
        (error.handled ? `\nOriginal error: ${error.handled.message}.` : ""),
      { expose: isHttpError(error.cause) ? error.cause.expose : false }, // retain the cause exposition setting
    ),
  );
  response.status(500).type("text/plain").end(message);
};
