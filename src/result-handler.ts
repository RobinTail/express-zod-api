import { Request, Response } from "express";
import { Logger } from "winston";
import { z } from "zod";
import { ApiResponse, createApiResponse } from "./api-response";
import { ResultHandlerError } from "./errors";
import { getMessageFromError, getStatusCodeFromError } from "./common-helpers";
import { IOSchema } from "./io-schema";
import { getMeta, withMeta } from "./metadata";

interface LastResortHandlerParams {
  error: ResultHandlerError;
  logger: Logger;
  response: Response;
}

interface ResultHandlerParams<RES> {
  error: Error | null;
  input: any;
  output: any;
  request: Request;
  response: Response<RES>;
  logger: Logger;
}

type ResultHandler<RES> = (
  params: ResultHandlerParams<RES>
) => void | Promise<void>;

export interface ResultHandlerDefinition<
  POS extends ApiResponse,
  NEG extends ApiResponse
> {
  getPositiveResponse: (output: IOSchema) => POS;
  getNegativeResponse: () => NEG;
  handler: ResultHandler<z.output<POS["schema"]> | z.output<NEG["schema"]>>;
}

export const createResultHandler = <
  POS extends ApiResponse,
  NEG extends ApiResponse
>(
  definition: ResultHandlerDefinition<POS, NEG>
) => definition;

export const defaultResultHandler = createResultHandler({
  getPositiveResponse: (output: IOSchema) => {
    const examples = getMeta(output, "examples") || [];
    const responseSchema = withMeta(
      z.object({
        status: z.literal("success"),
        data: output,
      })
    );
    for (const example of examples) {
      // forwarding output examples to response schema
      responseSchema.example({
        status: "success",
        data: example,
      });
    }
    return createApiResponse(responseSchema);
  },
  getNegativeResponse: () => {
    const responseSchema = withMeta(
      z.object({
        status: z.literal("error"),
        error: z.object({
          message: z.string(),
        }),
      })
    ).example({
      status: "error",
      error: {
        message: getMessageFromError(new Error("Sample error message")),
      },
    });
    return createApiResponse(responseSchema);
  },
  handler: ({ error, input, output, request, response, logger }) => {
    if (!error) {
      response.status(200).json({
        status: "success" as const,
        data: output,
      });
      return;
    }
    const statusCode = getStatusCodeFromError(error);
    if (statusCode === 500) {
      logger.error(`Internal server error\n${error.stack}\n`, {
        url: request.url,
        payload: input,
      });
    }
    response.status(statusCode).json({
      status: "error" as const,
      error: { message: getMessageFromError(error) },
    });
  },
});

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
          : "")
    );
};
