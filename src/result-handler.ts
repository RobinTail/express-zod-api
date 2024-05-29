import { Request, Response } from "express";
import { z } from "zod";
import {
  AnyApiResponse,
  LazyResponse,
  normalize,
  NormalizedResponse,
} from "./api-response";
import {
  FlatObject,
  getExamples,
  getMessageFromError,
  getStatusCodeFromError,
  isObject,
  logInternalError,
} from "./common-helpers";
import { contentTypes } from "./content-type";
import { IOSchema } from "./io-schema";
import { ActualLogger } from "./logger-helpers";

export const defaultStatusCodes = {
  positive: 200,
  negative: 400,
};

type Handler<RES> = (params: {
  /** null in case of failure to parse or to find the matching endpoint (error: not found) */
  input: FlatObject | null;
  /** null in case of errors or failures */
  output: FlatObject | null;
  /** can be empty: check presence of the required property using "in" operator */
  options: FlatObject;
  error: Error | null;
  request: Request;
  response: Response<RES>;
  logger: ActualLogger;
}) => void | Promise<void>;

type ResponseSchema<T extends AnyApiResponse> =
  T extends AnyApiResponse<infer S> ? S : never;

export abstract class AbstractResultHandler {
  readonly #handler: Handler<unknown>;
  public abstract getPositiveResponse(output: IOSchema): NormalizedResponse[];
  public abstract getNegativeResponse(): NormalizedResponse[];

  protected constructor(handler: Handler<unknown>) {
    this.#handler = handler;
  }

  public execute(...params: Parameters<Handler<unknown>>) {
    return this.#handler(...params);
  }
}

export class ResultHandler<
  POS extends AnyApiResponse,
  NEG extends AnyApiResponse,
> extends AbstractResultHandler {
  readonly #positive: POS | LazyResponse<POS, [IOSchema]>;
  readonly #negative: NEG | LazyResponse<NEG>;

  constructor({
    positive,
    negative,
    handler,
  }: {
    positive: POS | LazyResponse<POS, [IOSchema]>;
    negative: NEG | LazyResponse<NEG>;
    handler: Handler<z.output<ResponseSchema<POS> | ResponseSchema<NEG>>>;
  }) {
    super(handler);
    this.#positive = positive;
    this.#negative = negative;
  }

  public override getPositiveResponse(output: IOSchema) {
    return normalize(this.#positive, {
      arguments: [output],
      statusCodes: [defaultStatusCodes.positive],
      mimeTypes: [contentTypes.json],
    });
  }

  public override getNegativeResponse() {
    return normalize(this.#negative, {
      arguments: [],
      statusCodes: [defaultStatusCodes.negative],
      mimeTypes: [contentTypes.json],
    });
  }
}

export const defaultResultHandler = new ResultHandler({
  positive: (output) => {
    // Examples are taken for proxying: no validation needed for this
    const examples = getExamples({ schema: output });
    const responseSchema = z.object({
      status: z.literal("success"),
      data: output,
    });
    return examples.reduce<typeof responseSchema>(
      (acc, example) =>
        acc.example({
          status: "success",
          data: example,
        }),
      responseSchema,
    );
  },
  negative: z
    .object({
      status: z.literal("error"),
      error: z.object({
        message: z.string(),
      }),
    })
    .example({
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
export const arrayResultHandler = new ResultHandler({
  positive: (output) => {
    // Examples are taken for proxying: no validation needed for this
    const examples = getExamples({ schema: output });
    const responseSchema =
      "shape" in output &&
      "items" in output.shape &&
      output.shape.items instanceof z.ZodArray
        ? (output.shape.items as z.ZodArray<z.ZodTypeAny>)
        : z.array(z.any());
    return examples.reduce<typeof responseSchema>(
      (acc, example) =>
        isObject(example) && "items" in example && Array.isArray(example.items)
          ? acc.example(example.items)
          : acc,
      responseSchema,
    );
  },
  negative: z
    .string()
    .example(getMessageFromError(new Error("Sample error message"))),
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
