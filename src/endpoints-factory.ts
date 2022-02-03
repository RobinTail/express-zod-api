import { RequestHandler, NextFunction } from "express";
import { z } from "zod";
import { ApiResponse } from "./api-response";
import { Endpoint, Handler } from "./endpoint";
import { FlatObject, IOSchema, hasUpload, Merge } from "./common-helpers";
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

  public addExpressMiddleware<M extends RequestHandler, OUT extends FlatObject>(
    middleware: M,
    provider: (request: Parameters<M>[0], response: Parameters<M>[1]) => OUT
  ) {
    return EndpointsFactory.#create<MwIN, MwOUT & OUT, POS, NEG>(
      this.middlewares.concat(
        createMiddleware({
          input: z.object({}),
          middleware: async ({ request, response }) => {
            return new Promise<OUT>((resolve, reject) => {
              const next: NextFunction = (err) => {
                if (err && err instanceof Error) {
                  reject(err);
                }
                resolve(provider(request, response));
              };
              middleware(request, response, next);
            });
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
