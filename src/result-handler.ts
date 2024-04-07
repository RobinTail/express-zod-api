import { Request, Response } from "express";
import { z } from "zod";
import {
  AnyResponseDefinition,
  ApiResponse,
  defaultStatusCodes,
} from "./api-response";
import {
  FlatObject,
  getExamples,
  isObject,
  logInternalError,
} from "./common-helpers";
import { getMessageFromError, getStatusCodeFromError } from "./error-helpers";
import { IOSchema } from "./io-schema";
import { AbstractLogger } from "./logger";
import { withMeta } from "./metadata";

interface ResultHandlerParams<RES> {
  /** null in case of failure to parse or to find the matching endpoint (error: not found) */
  input: FlatObject | null;
  /** null in case of errors or failures */
  output: FlatObject | null;
  /** can be empty: check presence of the required property using "in" operator */
  options: FlatObject;
  error: Error | null;
  request: Request;
  response: Response<RES>;
  logger: AbstractLogger;
}

type ResultHandler<RES> = (
  params: ResultHandlerParams<RES>,
) => void | Promise<void>;

type ExtractSchema<T extends AnyResponseDefinition> = T extends ApiResponse<
  infer S
>[]
  ? S
  : T extends ApiResponse<infer S>
    ? S
    : T extends z.ZodTypeAny
      ? T
      : never;

export interface ResultHandlerDefinition<
  POS extends AnyResponseDefinition,
  NEG extends AnyResponseDefinition,
> {
  getPositiveResponse: (output: IOSchema) => POS;
  getNegativeResponse: () => NEG;
  handler: ResultHandler<
    z.output<ExtractSchema<POS>> | z.output<ExtractSchema<NEG>>
  >;
}

export type AnyResultHandlerDefinition = ResultHandlerDefinition<
  AnyResponseDefinition,
  AnyResponseDefinition
>;

export const createResultHandler = <
  POS extends AnyResponseDefinition,
  NEG extends AnyResponseDefinition,
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
        status: "success",
        data: output,
      });
      return;
    }
    const statusCode = getStatusCodeFromError(error);
    logInternalError({ logger, statusCode, request, error, input });
    response.status(statusCode).json({
      status: "error",
      error: { message: getMessageFromError(error) },
    });
  },
});

/**
 * @deprecated Resist the urge of using it: this handler is designed only to simplify the migration of legacy APIs.
 * @desc Responding with array is a bad practice keeping your endpoints from evolving without breaking changes.
 * @desc This handler expects your endpoint to have the property 'items' in the output object schema
 * */
export const arrayResultHandler = createResultHandler({
  getPositiveResponse: (output) => {
    // Examples are taken for proxying: no validation needed for this
    const examples = getExamples({ schema: output });
    const responseSchema = withMeta(
      "shape" in output &&
        "items" in output.shape &&
        output.shape.items instanceof z.ZodArray
        ? (output.shape.items as z.ZodArray<z.ZodTypeAny>)
        : z.array(z.any()),
    );
    return examples.reduce<typeof responseSchema>(
      (acc, example) =>
        isObject(example) && "items" in example && Array.isArray(example.items)
          ? acc.example(example.items)
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
    if (output && "items" in output && Array.isArray(output.items)) {
      response.status(defaultStatusCodes.positive).json(output.items);
    } else {
      response
        .status(500)
        .send("Property 'items' is missing in the endpoint output");
    }
  },
});
