import { Request, Response } from "express";
import { Logger } from "winston";
import { z } from "zod";
import { ResultHandlerError } from "./errors";
import {
  getMessageFromError,
  getStatusCodeFromError,
  IOSchema,
  markOutput,
} from "./common-helpers";
import { getMeta, withMeta } from "./metadata";
import { mimeJson } from "./mime";

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
  POS extends z.ZodTypeAny,
  NEG extends z.ZodTypeAny
> {
  getPositiveResponse: <OUT extends IOSchema>(output: OUT) => POS;
  getNegativeResponse: () => NEG;
  handler: ResultHandler<z.output<POS> | z.output<NEG>>;
  positiveMimeTypes: string[];
  negativeMimeTypes: string[];
}

export const createResultHandler = <
  POS extends z.ZodTypeAny,
  NEG extends z.ZodTypeAny
>(
  definition: Omit<
    ResultHandlerDefinition<POS, NEG>,
    "positiveMimeTypes" | "negativeMimeTypes"
  > &
    Partial<
      Pick<
        ResultHandlerDefinition<POS, NEG>,
        "positiveMimeTypes" | "negativeMimeTypes"
      >
    >
): ResultHandlerDefinition<POS, NEG> => ({
  ...definition,
  positiveMimeTypes: definition.positiveMimeTypes || [mimeJson],
  negativeMimeTypes: definition.negativeMimeTypes || [mimeJson],
});

export const defaultResultHandler = createResultHandler({
  getPositiveResponse: <OUT extends IOSchema>(output: OUT) => {
    const examples = getMeta(output, "examples") || [];
    const responseSchema = withMeta(
      z.object({
        status: z.literal("success"),
        data: markOutput(output),
      })
    );
    for (const example of examples) {
      // forwarding output examples to response schema
      responseSchema.example({
        status: "success",
        data: example,
      });
    }
    return responseSchema;
  },
  getNegativeResponse: () =>
    withMeta(
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
    }),
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
        (error.hasOriginalError()
          ? `\nOriginal error: ${error.getOriginalErrorMessage()}.`
          : "")
    );
};
