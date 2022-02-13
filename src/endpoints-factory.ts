import { Request, Response } from "express";
import { z } from "zod";
import { ApiResponse } from "./api-response";
import { Endpoint, Handler } from "./endpoint";
import { FlatObject, IOSchema, hasUpload, Merge } from "./common-helpers";
import { Method, MethodsDefinition } from "./method";
import {
  createMiddleware,
  ExpressMiddleware,
  ExpressMiddlewareFeatures,
  MiddlewareDefinition,
} from "./middleware";
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
    OUT extends FlatObject = {}
  >(
    middleware: ExpressMiddleware<R, S>,
    features?: ExpressMiddlewareFeatures<R, S, OUT>
  ) {
    const transformer = features?.transformer || ((err: Error) => err);
    const provider = features?.provider || (() => ({} as OUT));
    const definition = createMiddleware({
      input: z.object({}),
      middleware: async ({ request, response }) =>
        new Promise<OUT>((resolve, reject) => {
          const next = (err?: any) => {
            if (err && err instanceof Error) {
              return reject(transformer(err));
            }
            resolve(provider(request as R, response as S));
          };
          middleware(request as R, response as S, next);
        }),
    });
    return EndpointsFactory.#create<MwIN, MwOUT & OUT, POS, NEG>(
      this.middlewares.concat(definition),
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
