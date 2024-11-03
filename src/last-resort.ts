import { Response } from "express";
import createHttpError from "http-errors";
import { ResultHandlerError } from "./errors";
import { ActualLogger } from "./logger-helpers";
import { getPublicErrorMessage } from "./result-helpers";

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
    ),
  );
  response.status(500).type("text/plain").end(message);
};
