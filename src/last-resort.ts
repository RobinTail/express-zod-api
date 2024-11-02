import { Response } from "express";
import { ResultHandlerError } from "./errors";
import { ActualLogger } from "./logger-helpers";

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
  logger.error(`Result handler failure: ${error.message}.`);
  response
    .status(500)
    .type("text/plain")
    .end(
      `An error occurred while serving the result: ${error.message}.` +
        (error.processed
          ? `\nOriginal error: ${error.processed.message}.`
          : ""),
    );
};
