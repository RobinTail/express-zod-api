import { Request, Response } from "express";
import { globalRegistry, z } from "zod/v4";
import {
  ApiResponse,
  defaultStatusCodes,
  NormalizedResponse,
} from "./api-response";
import { FlatObject, isObject } from "./common-helpers";
import { contentTypes } from "./content-type";
import { IOSchema } from "./io-schema";
import { ActualLogger } from "./logger-helpers";
import {
  DiscriminatedResult,
  ensureHttpError,
  getPublicErrorMessage,
  logServerError,
  normalize,
  ResultSchema,
} from "./result-helpers";

type Handler<RES = unknown> = (
  params: DiscriminatedResult & {
    /** null in case of failure to parse or to find the matching endpoint (error: not found) */
    input: FlatObject | null;
    /** can be empty: check presence of the required property using "in" operator */
    options: FlatObject;
    request: Request;
    response: Response<RES>;
    logger: ActualLogger;
  },
) => void | Promise<void>;

export type Result<S extends z.ZodType = z.ZodType> =
  | S // plain schema, default status codes applied
  | ApiResponse<S> // single response definition, status code(s) customizable
  | ApiResponse<S>[]; // Feature #1431: different responses for different status codes (non-empty, prog. check!)

export type LazyResult<R extends Result, A extends unknown[] = []> = (
  ...args: A
) => R;

export abstract class AbstractResultHandler {
  readonly #handler: Handler;
  /** @internal */
  public abstract getPositiveResponse(output: IOSchema): NormalizedResponse[];
  /** @internal */
  public abstract getNegativeResponse(): NormalizedResponse[];
  protected constructor(handler: Handler) {
    this.#handler = handler;
  }
  public execute(...params: Parameters<Handler>) {
    return this.#handler(...params);
  }
}

export class ResultHandler<
  POS extends Result,
  NEG extends Result,
> extends AbstractResultHandler {
  readonly #positive: POS | LazyResult<POS, [IOSchema]>;
  readonly #negative: NEG | LazyResult<NEG>;

  constructor(params: {
    /** @desc A description of the API response in case of success (schema, status code, MIME type) */
    positive: POS | LazyResult<POS, [IOSchema]>;
    /** @desc A description of the API response in case of error (schema, status code, MIME type) */
    negative: NEG | LazyResult<NEG>;
    /** @desc The actual implementation to transmit the response in any case */
    handler: Handler<z.output<ResultSchema<POS> | ResultSchema<NEG>>>;
  }) {
    super(params.handler);
    this.#positive = params.positive;
    this.#negative = params.negative;
  }

  /** @internal */
  public override getPositiveResponse(output: IOSchema) {
    return normalize(this.#positive, {
      variant: "positive",
      args: [output],
      statusCodes: [defaultStatusCodes.positive],
      mimeTypes: [contentTypes.json],
    });
  }

  /** @internal */
  public override getNegativeResponse() {
    return normalize(this.#negative, {
      variant: "negative",
      args: [],
      statusCodes: [defaultStatusCodes.negative],
      mimeTypes: [contentTypes.json],
    });
  }
}

export const defaultResultHandler = new ResultHandler({
  positive: (output) => {
    const responseSchema = z.object({
      status: z.literal("success"),
      data: output,
    });
    const { examples = [] } = globalRegistry.get(output) || {}; // pulling down:
    if (examples.length) {
      globalRegistry.add(responseSchema, {
        examples: examples.map((data) => ({
          status: "success" as const,
          data,
        })),
      });
    }
    return responseSchema;
  },
  negative: z
    .object({
      status: z.literal("error"),
      error: z.object({ message: z.string() }),
    })
    .example({
      status: "error",
      error: { message: "Sample error message" },
    }),
  handler: ({ error, input, output, request, response, logger }) => {
    if (error) {
      const httpError = ensureHttpError(error);
      logServerError(httpError, logger, request, input);
      return void response
        .status(httpError.statusCode)
        .set(httpError.headers)
        .json({
          status: "error",
          error: { message: getPublicErrorMessage(httpError) },
        });
    }
    response
      .status(defaultStatusCodes.positive)
      .json({ status: "success", data: output });
  },
});

/**
 * @deprecated Resist the urge of using it: this handler is designed only to simplify the migration of legacy APIs.
 * @desc Responding with array is a bad practice keeping your endpoints from evolving without breaking changes.
 * @desc This handler expects your endpoint to have the property 'items' in the output object schema
 * */
export const arrayResultHandler = new ResultHandler({
  positive: (output) => {
    const responseSchema =
      output instanceof z.ZodObject &&
      "items" in output.shape &&
      output.shape.items instanceof z.ZodArray
        ? output.shape.items
        : z.array(z.any());
    const meta = responseSchema.meta();
    if (meta?.examples?.length) return responseSchema; // has examples on the items, or pull down:
    const examples = (globalRegistry.get(output)?.examples || [])
      .filter(
        (example): example is { items: unknown[] } =>
          isObject(example) &&
          "items" in example &&
          Array.isArray(example.items),
      )
      .map((example) => example.items);
    if (examples.length) {
      globalRegistry
        .remove(responseSchema) // reassign to avoid cloning
        .add(responseSchema, { ...meta, examples });
    }
    return responseSchema;
  },
  negative: z.string().example("Sample error message"),
  handler: ({ response, output, error, logger, request, input }) => {
    if (error) {
      const httpError = ensureHttpError(error);
      logServerError(httpError, logger, request, input);
      return void response
        .status(httpError.statusCode)
        .type("text/plain")
        .send(getPublicErrorMessage(httpError));
    }
    if ("items" in output && Array.isArray(output.items)) {
      return void response
        .status(defaultStatusCodes.positive)
        .json(output.items);
    }
    throw new Error("Property 'items' is missing in the endpoint output");
  },
});
