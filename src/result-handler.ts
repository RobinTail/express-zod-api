import { Request, Response } from "express";
import { z } from "zod";
import {
  AnyResponseDefinition,
  defaultStatusCodes,
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

export abstract class AbstractResultHandler {
  readonly #handler: Handler<unknown>;

  protected constructor(handler: Handler<unknown>) {
    this.#handler = handler;
  }

  public execute(...params: Parameters<Handler<unknown>>) {
    return this.#handler(...params);
  }

  public abstract getPositiveResponse(
    output: IOSchema,
  ): NormalizedResponse<z.ZodTypeAny>[];
  public abstract getNegativeResponse(): NormalizedResponse<z.ZodTypeAny>[];

  protected normalize(
    subject: AnyResponseDefinition,
    fallback: {
      statusCodes: [number, ...number[]];
      mimeTypes: [string, ...string[]];
    },
  ): NormalizedResponse<z.ZodTypeAny>[] {
    if (subject instanceof z.ZodType) {
      return [{ ...fallback, schema: subject }];
    }
    return (Array.isArray(subject) ? subject : [subject]).map(
      ({ schema, statusCodes, statusCode, mimeTypes, mimeType }) => ({
        schema,
        statusCodes: statusCode
          ? [statusCode]
          : statusCodes || fallback.statusCodes,
        mimeTypes: mimeType ? [mimeType] : mimeTypes || fallback.mimeTypes,
      }),
    );
  }
}

export class ResultHandler<
  POS extends AnyResponseDefinition,
  NEG extends AnyResponseDefinition,
> extends AbstractResultHandler {
  readonly #positive: (output: IOSchema) => POS;
  readonly #negative: NEG;

  constructor({
    positive,
    negative,
    handler,
  }: {
    // @todo support both optionally functional
    positive: (output: IOSchema) => POS;
    negative: NEG;
    handler: Handler<z.output<ExtractSchema<POS> | ExtractSchema<NEG>>>;
  }) {
    super(handler);
    this.#positive = positive;
    this.#negative = negative;
  }

  public override getPositiveResponse(output: IOSchema) {
    const userDefined = this.#positive(output);
    return this.normalize(userDefined, {
      statusCodes: [defaultStatusCodes.positive],
      mimeTypes: [contentTypes.json],
    });
  }

  public override getNegativeResponse() {
    return this.normalize(this.#negative, {
      statusCodes: [defaultStatusCodes.negative],
      mimeTypes: [contentTypes.json],
    });
  }
}

type ExtractSchema<T extends AnyResponseDefinition> =
  T extends AnyResponseDefinition<infer S> ? S : never;

export const defaultResultHandler = new ResultHandler({
  positive: (output: IOSchema) => {
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
