import { Request, Response } from "express";
import { z } from "zod";
import { ApiResponse } from "./api-response";
import { FlatObject, hasUpload, IOSchema } from "./common-helpers";
import { Endpoint, Handler } from "./endpoint";
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

type AnyMiddlewareDef = MiddlewareDefinition<IOSchema, any, any>;

type BuildProps<
  IN extends IOSchema,
  OUT extends IOSchema,
  MIN extends IOSchema,
  OPT extends FlatObject,
  M extends Method
> = {
  input: IN;
  output: OUT;
  handler: Handler<z.output<z.ZodIntersection<MIN, IN>>, z.input<OUT>, OPT>;
  description?: string;
} & MethodsDefinition<M>;

export class EndpointsFactory<
  POS extends ApiResponse,
  NEG extends ApiResponse,
  IN extends IOSchema,
  OUT extends FlatObject
> {
  protected middlewares: AnyMiddlewareDef[] = [];

  constructor(protected resultHandler: ResultHandlerDefinition<POS, NEG>) {}

  static #create<
    CPOS extends ApiResponse,
    CNEG extends ApiResponse,
    CIN extends IOSchema,
    COUT extends FlatObject
  >(
    middlewares: AnyMiddlewareDef[],
    resultHandler: ResultHandlerDefinition<CPOS, CNEG>
  ) {
    const factory = new EndpointsFactory<CPOS, CNEG, CIN, COUT>(resultHandler);
    factory.middlewares = middlewares;
    return factory;
  }

  public addMiddleware<AIN extends IOSchema, AOUT extends FlatObject>(
    definition: MiddlewareDefinition<AIN, OUT, AOUT>
  ) {
    return EndpointsFactory.#create<
      POS,
      NEG,
      z.ZodIntersection<IN, AIN>,
      OUT & AOUT
    >(
      this.middlewares.concat(definition as unknown as AnyMiddlewareDef),
      this.resultHandler
    );
  }

  public use = this.addExpressMiddleware;

  public addExpressMiddleware<
    R extends Request,
    S extends Response,
    AOUT extends FlatObject = {}
  >(
    middleware: ExpressMiddleware<R, S>,
    features?: ExpressMiddlewareFeatures<R, S, AOUT>
  ) {
    const transformer = features?.transformer || ((err: Error) => err);
    const provider = features?.provider || (() => ({} as AOUT));
    const definition = createMiddleware({
      input: z.object({}),
      middleware: async ({ request, response }) =>
        new Promise<AOUT>((resolve, reject) => {
          const next = (err?: any) => {
            if (err && err instanceof Error) {
              return reject(transformer(err));
            }
            resolve(provider(request as R, response as S));
          };
          middleware(request as R, response as S, next);
        }),
    });
    return EndpointsFactory.#create<POS, NEG, IN, OUT & AOUT>(
      this.middlewares.concat(definition as AnyMiddlewareDef),
      this.resultHandler
    );
  }

  public addOptions<AOUT extends FlatObject>(options: AOUT) {
    return EndpointsFactory.#create<POS, NEG, IN, OUT & AOUT>(
      this.middlewares.concat(
        createMiddleware({
          input: z.object({}),
          middleware: async () => options,
        }) as AnyMiddlewareDef
      ),
      this.resultHandler
    );
  }

  public build<BIN extends IOSchema, BOUT extends IOSchema, M extends Method>({
    input,
    output,
    handler,
    description,
    ...rest
  }: BuildProps<BIN, BOUT, IN, OUT, M>) {
    const inputSchema = this.middlewares
      .map(({ input: schema }) => schema)
      .concat(input)
      .reduce((acc, schema) => acc.and(schema)) as z.ZodIntersection<IN, BIN>;
    return new Endpoint<z.ZodIntersection<IN, BIN>, BOUT, OUT, M, POS, NEG>({
      handler,
      description,
      middlewares: this.middlewares,
      inputSchema,
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
