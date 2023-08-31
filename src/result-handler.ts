import { Request, Response } from "express";
import { Logger } from "winston";
import { z } from "zod";
import { ApiResponse } from "./api-response";
import {
  getExamples,
  getMessageFromError,
  getStatusCodeFromError,
  logInternalError,
} from "./common-helpers";
import { ResultHandlerError } from "./errors";
import { IOSchema } from "./io-schema";
import { withMeta } from "./metadata";

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
  params: ResultHandlerParams<RES>,
) => void | Promise<void>;

export interface ResultHandlerDefinition<
  POS extends z.ZodTypeAny,
  NEG extends z.ZodTypeAny,
> {
  getPositiveResponse: (output: IOSchema) => POS | ApiResponse<POS>;
  getNegativeResponse: () => NEG | ApiResponse<NEG>;
  handler: ResultHandler<z.output<POS> | z.output<NEG>>;
}

export const defaultStatusCodes = {
  positive: 200,
  negative: 400,
};

export const createResultHandler = <
  POS extends z.ZodTypeAny,
  NEG extends z.ZodTypeAny,
>(
  definition: ResultHandlerDefinition<POS, NEG>,
) => definition;

export const defaultResultHandler = createResultHandler({
  getPositiveResponse: (output: IOSchema) => {
    // Examples are taken for proxying: no validation needed for this
    const examples = getExamples({ schema: output });
    const responseSchema = withMeta(
      z.object({
        status: z.literal("success"),
        data: output,
      }),
    );
    return examples.reduce<typeof responseSchema>(
      (acc, example) =>
        acc.example({
          status: "success",
          data: example,
        }),
      responseSchema,
    );
  },
  getNegativeResponse: () =>
    withMeta(
      z.object({
        status: z.literal("error"),
        error: z.object({
          message: z.string(),
        }),
      }),
    ).example({
      status: "error",
      error: {
        message: getMessageFromError(new Error("Sample error message")),
      },
    }),
  handler: ({ error, input, output, request, response, logger }) => {
    if (!error) {
      response.status(defaultStatusCodes.positive).json({
        status: "success" as const,
        data: output,
      });
      return;
    }
    const statusCode = getStatusCodeFromError(error);
    logInternalError({ logger, statusCode, request, error, input });
    response.status(statusCode).json({
      status: "error" as const,
      error: { message: getMessageFromError(error) },
    });
  },
});

/**
 * @deprecated Resist the urge of using it: this handler is designed only to simplify the migration of legacy APIs.
 * @desc Responding with array is a bad practice keeping your endpoints from evolving without breaking changes.
 * @desc This handler expects your endpoint to have the property 'array' in the output object schema
 * */
export const arrayResultHandler = createResultHandler({
  getPositiveResponse: (output) => {
    // Examples are taken for proxying: no validation needed for this
    const examples = getExamples({ schema: output });
    const responseSchema = withMeta(
      "shape" in output &&
        "array" in output.shape &&
        output.shape.array instanceof z.ZodArray
        ? output.shape.array
        : z.array(z.any()),
    );
    return examples.reduce<typeof responseSchema>(
      (acc, example) =>
        typeof example === "object" && example !== null && "array" in example
          ? acc.example(example.array)
          : acc,
      responseSchema,
    );
  },
  getNegativeResponse: () =>
    withMeta(z.string()).example(
      getMessageFromError(new Error("Sample error message")),
    ),
  handler: ({ response, output, error, logger, request, input }) => {
    if (error) {
      const statusCode = getStatusCodeFromError(error);
      logInternalError({ logger, statusCode, request, error, input });
      response.status(statusCode).send(error.message);
      return;
    }
    if ("array" in output && Array.isArray(output.array)) {
      response.status(200).json(output.array);
    } else {
      response
        .status(500)
        .send("Property 'array' is missing in the endpoint output");
    }
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
          : ""),
    );
};
