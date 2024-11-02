import { Response } from "express";
import { CommonConfig } from "./config-type";
import { ResultHandlerError } from "./errors";
import { ActualLogger } from "./logger-helpers";

interface LastResortHandlerParams {
  error: ResultHandlerError;
  logger: ActualLogger;
  response: Response;
  config: Pick<CommonConfig, "hideInternalErrors">;
}

export const lastResortHandler = ({
  error,
  logger,
  response,
  config: { hideInternalErrors },
}: LastResortHandlerParams) => {
  logger.error("Result Handler failure", error);
  let output = "An error occurred while serving the result";
  if (hideInternalErrors) output += ".";
  else {
    output += `: ${error.message}.`;
    if (error.cause?.processed)
      output += `\nOriginal error: ${error.cause.processed.message}.`;
  }
  response.status(500).type("text/plain").end(output);
};
