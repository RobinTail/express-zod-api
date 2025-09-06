import { Request, Response } from "express";
import { globalRegistry, z } from "zod";
import {
  ApiResponse,
  defaultStatusCodes,
  NormalizedResponse,
} from "./api-response";
import { FlatObject, isObject } from "./common-helpers";
import { IOSchema } from "./io-schema";
import { ActualLogger } from "./logger-helpers";
import {
  DiscriminatedResult,
  ensureHttpError,
  getPublicErrorMessage,
  logServerError,
  ResultSchema,
} from "./result-helpers";
import { ResultHandlerError } from "./errors";

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
  OUT extends IOSchema,
  POS extends Result,
  NEG extends Result,
> extends AbstractResultHandler {
  readonly #positive: ApiResponse<z.ZodType>[] | LazyResult<Result, [OUT]>;
  readonly #negative: ApiResponse<z.ZodType>[];

  constructor({
    handler,
    positive,
    negative,
  }: {
    /** @desc A description of the API response in case of success (schema, status code, MIME type) */
    positive: POS | LazyResult<POS, [OUT]>;
    /** @desc A description of the API response in case of error (schema, status code, MIME type) */
    negative: NEG | LazyResult<NEG>;
    /** @desc The actual implementation to transmit the response in any case */
    handler: Handler<z.output<ResultSchema<POS> | ResultSchema<NEG>>>;
  }) {
    super(handler);
    this.#positive =
      positive instanceof z.ZodType
        ? [new ApiResponse(positive)]
        : positive instanceof ApiResponse
          ? [positive]
          : positive;
    const resolvedNeg = typeof negative === "function" ? negative() : negative;
    this.#negative =
      resolvedNeg instanceof z.ZodType
        ? [new ApiResponse(resolvedNeg)]
        : resolvedNeg instanceof ApiResponse
          ? [resolvedNeg]
          : resolvedNeg;
  }

  /** @internal */
  public override getPositiveResponse(output: OUT) {
    const resolvedPos =
      typeof this.#positive === "function"
        ? this.#positive(output)
        : this.#positive;
    const arr =
      resolvedPos instanceof z.ZodType
        ? [new ApiResponse(resolvedPos)]
        : resolvedPos instanceof ApiResponse
          ? [resolvedPos]
          : resolvedPos;
    if (arr.length === 0) {
      throw new ResultHandlerError(
        new Error("At least one positive response schema required."),
      );
    }
    return arr.map((one) => one.normalize(defaultStatusCodes.positive));
  }

  /** @internal */
  public override getNegativeResponse() {
    if (this.#negative.length === 0) {
      throw new ResultHandlerError(
        new Error("At least one negative response schema required."),
      );
    }
    return this.#negative.map((one) =>
      one.normalize(defaultStatusCodes.negative),
    );
  }
}

export const defaultResultHandler = new ResultHandler({
  positive: (output) => {
    const responseSchema = z.object({
      status: z.literal("success"),
      data: output,
    });
    const { examples } = globalRegistry.get(output) || {}; // pulling down:
    if (examples?.length) {
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
  positive: (output: z.ZodObject<{ items: z.ZodArray<z.ZodType> }>) => {
    const responseSchema = output.shape.items;
    if (globalRegistry.get(responseSchema)?.examples?.length)
      return responseSchema; // has examples on the items, or pull down:
    const examples = globalRegistry
      .get(output)
      ?.examples?.filter(
        (example): example is { items: unknown[] } =>
          isObject(example) &&
          "items" in example &&
          Array.isArray(example.items),
      )
      .map((example) => example.items);
    if (examples?.length) {
      const current = responseSchema.meta();
      globalRegistry
        .remove(responseSchema) // reassign to avoid cloning
        .add(responseSchema, { ...current, examples });
    }
    return responseSchema;
  },
  negative: new ApiResponse({
    schema: z.string().example("Sample error message"),
    mimeType: "text/plain",
  }),
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
