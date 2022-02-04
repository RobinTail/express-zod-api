import { Request, Response } from "express";
import { HttpError } from "http-errors";
import { z } from "zod";
import { ApiResponse } from "./api-response";
import { Endpoint, Handler } from "./endpoint";
import { FlatObject, IOSchema, hasUpload, Merge } from "./common-helpers";
import { createHttpError } from "./index";
import { Method, MethodsDefinition } from "./method";
import { createMiddleware, MiddlewareDefinition } from "./middleware";
import { mimeJson, mimeMultipart } from "./mime";
import {
  defaultResultHandler,
  ResultHandlerDefinition,
} from "./result-handler";

type BuildProps<
  IN extends IOSchema,
  OUT extends IOSchema,
  MwIN,
  MwOUT,
  M extends Method
> = {
  input: IN;
  output: OUT;
  handler: Handler<z.output<Merge<IN, MwIN>>, z.input<OUT>, MwOUT>;
  description?: string;
} & MethodsDefinition<M>;

export class EndpointsFactory<
  MwIN,
  MwOUT,
  POS extends ApiResponse,
  NEG extends ApiResponse
> {
  protected middlewares: MiddlewareDefinition<any, any, any>[] = [];

  constructor(protected resultHandler: ResultHandlerDefinition<POS, NEG>) {
    this.resultHandler = resultHandler;
  }

  static #create<
    CrMwIN,
    CrMwOUT,
    CrPOS extends ApiResponse,
    CrNEG extends ApiResponse
  >(
    middlewares: MiddlewareDefinition<any, any, any>[],
    resultHandler: ResultHandlerDefinition<CrPOS, CrNEG>
  ) {
    const factory = new EndpointsFactory<CrMwIN, CrMwOUT, CrPOS, CrNEG>(
      resultHandler
    );
    factory.middlewares = middlewares;
    return factory;
  }

  public addMiddleware<IN extends IOSchema, OUT extends FlatObject>(
    definition: MiddlewareDefinition<IN, MwOUT, OUT>
  ) {
    return EndpointsFactory.#create<Merge<IN, MwIN>, MwOUT & OUT, POS, NEG>(
      this.middlewares.concat(definition),
      this.resultHandler
    );
  }

  public addExpressMiddleware<
    R extends Request,
    S extends Response,
    OUT extends FlatObject
  >(
    middleware: (
      request: R,
      response: S,
      next: (error?: any) => void
    ) => void | Promise<void>,
    provider: (request: R, response: S) => OUT | Promise<OUT>
  ) {
    return EndpointsFactory.#create<MwIN, MwOUT & OUT, POS, NEG>(
      this.middlewares.concat(
        createMiddleware({
          input: z.object({}),
          middleware: async ({ request, response }) => {
            await new Promise<null>((resolve, reject) => {
              const next = (err?: any) => {
                // @todo How can I simplify it? or should I delegate it to the user?
                if (err && err instanceof Error) {
                  if ("status" in err || "statusCode" in err) {
                    return reject(
                      createHttpError(
                        (err as HttpError).status ||
                          (err as HttpError).statusCode,
                        (err as Error).message
                      )
                    );
                  }
                  return reject(err);
                }
                resolve(null);
              };
              middleware(request as R, response as S, next);
            });
            return provider(request as R, response as S);
          },
        })
      ),
      this.resultHandler
    );
  }

  public addOptions<OUT extends FlatObject>(options: OUT) {
    return EndpointsFactory.#create<MwIN, MwOUT & OUT, POS, NEG>(
      this.middlewares.concat(
        createMiddleware({
          input: z.object({}),
          middleware: async () => options,
        })
      ),
      this.resultHandler
    );
  }

  public build<IN extends IOSchema, OUT extends IOSchema, M extends Method>({
    input,
    output,
    handler,
    description,
    ...rest
  }: BuildProps<IN, OUT, MwIN, MwOUT, M>) {
    return new Endpoint<IN, OUT, MwIN, MwOUT, M, POS, NEG>({
      handler,
      description,
      middlewares: this.middlewares,
      inputSchema: input,
      outputSchema: output,
      resultHandler: this.resultHandler,
      mimeTypes: hasUpload(input) ? [mimeMultipart] : [mimeJson],
      ...rest,
    });
  }
}

export const defaultEndpointsFactory = new EndpointsFactory(
  defaultResultHandler
);
