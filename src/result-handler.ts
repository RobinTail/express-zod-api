import { Request, Response } from "express";
import { Logger } from "winston";
import { z } from "zod";
import { ResultHandlerError } from "./errors";
import {
  getMessageFromError,
  getStatusCodeFromError,
  IOSchema,
} from "./common-helpers";
import { Hkt } from "./hkt";
import { getMeta, withMeta } from "./metadata";
import { mimeJson } from "./mime";

interface LastResortHandlerParams {
  error: ResultHandlerError;
  logger: Logger;
  response: Response;
}

export interface ResultHandlerParams<RES> {
  error: Error | null;
  input: any;
  output: any;
  request: Request;
  response: Response<RES>;
  logger: Logger;
}

type EnsureSchema<OUT> = OUT extends IOSchema ? OUT : z.ZodNever;

export abstract class AbstractResultHandler<OUT> {
  protected readonly output: EnsureSchema<OUT>;
  public abstract readonly positiveResponse: z.ZodLazy<any>;
  public abstract readonly negativeResponse: z.ZodTypeAny;
  public readonly mimeTypes = {
    positive: [mimeJson],
    negative: [mimeJson],
  };
  constructor(schema: OUT) {
    this.output = (
      schema instanceof z.ZodType ? schema : z.never()
    ) as EnsureSchema<OUT>;
  }
  public abstract handler(
    params: ResultHandlerParams<
      z.output<this["positiveResponse"]> | z.output<this["negativeResponse"]>
    >
  ): void | Promise<void>;
}

interface DefaultResultHandlerHkt
  extends Hkt<unknown, DefaultResultHandler<any>> {
  [Hkt.output]: DefaultResultHandler<Hkt.Input<this>>;
}

// @todo provide lower-case backward compatibility alias
export class DefaultResultHandler<OUT> extends AbstractResultHandler<OUT> {
  static hkt: DefaultResultHandlerHkt;

  override positiveResponse = z.lazy(() => {
    const responseSchema = withMeta(
      z.object({
        status: z.literal("success"),
        data: this.output,
      })
    );
    const examples = getMeta(this.output, "examples") || [];
    for (const example of examples) {
      // forwarding output examples to response schema
      responseSchema.example({
        status: "success",
        // @ts-ignore // @todo fix it
        data: example,
      });
    }
    return responseSchema;
  });

  override negativeResponse = withMeta(
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

  override handler({
    error,
    input,
    output,
    request,
    response,
    logger,
  }: ResultHandlerParams<
    z.output<this["positiveResponse"]> | z.output<this["negativeResponse"]> // @todo shorten
  >) {
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
  }
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
        (error.hasOriginalError()
          ? `\nOriginal error: ${error.getOriginalErrorMessage()}.`
          : "")
    );
};
