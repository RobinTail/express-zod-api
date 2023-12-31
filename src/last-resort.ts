import { Response } from "express";
import { ResultHandlerError } from "./errors";
import { AbstractLogger } from "./logger";

interface LastResortHandlerParams {
  error: ResultHandlerError;
  logger: AbstractLogger;
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
    .end(
      `An error occurred while serving the result: ${error.message}.` +
        (error.originalError
          ? `\nOriginal error: ${error.originalError.message}.`
          : ""),
    );
};
