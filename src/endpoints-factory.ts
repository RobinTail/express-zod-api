import { Request, Response } from "express";
import { z } from "zod";
import { ApiResponse } from "./api-response";
import {
  FlatObject,
  getFinalEndpointInputSchema,
  hasUpload,
  IOSchema,
  ProbableIntersection,
} from "./common-helpers";
import { Endpoint, Handler } from "./endpoint";
import { Method, MethodsDefinition } from "./method";
import {
  AnyMiddlewareDef,
  createMiddleware,
  ExpressMiddleware,
  ExpressMiddlewareFeatures,
  MiddlewareCreationProps,
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
  MIN extends IOSchema<"strip"> | null,
  OPT extends FlatObject,
  M extends Method,
  SCO extends string
> = {
  input: IN;
  output: OUT;
  handler: Handler<z.output<ProbableIntersection<MIN, IN>>, z.input<OUT>, OPT>;
  description?: string;
  scopes?: SCO[];
} & MethodsDefinition<M>;

export class EndpointsFactory<
  POS extends ApiResponse,
  NEG extends ApiResponse,
  IN extends IOSchema<"strip"> | null = null,
  OUT extends FlatObject = {},
  SCO extends string = string
> {
  protected middlewares: AnyMiddlewareDef[] = [];

  constructor(protected resultHandler: ResultHandlerDefinition<POS, NEG>) {}

  static #create<
    CPOS extends ApiResponse,
    CNEG extends ApiResponse,
    CIN extends IOSchema<"strip"> | null,
    COUT extends FlatObject,
    CSCO extends string
  >(
    middlewares: AnyMiddlewareDef[],
    resultHandler: ResultHandlerDefinition<CPOS, CNEG>
  ) {
    const factory = new EndpointsFactory<CPOS, CNEG, CIN, COUT, CSCO>(
      resultHandler
    );
    factory.middlewares = middlewares;
    return factory;
  }

  public addMiddleware<
    AIN extends IOSchema<"strip">,
    AOUT extends FlatObject,
    ASCO extends string
  >(
    definition: MiddlewareDefinition<AIN, OUT, AOUT, ASCO>
  ): EndpointsFactory<
    POS,
    NEG,
    ProbableIntersection<IN, AIN>,
    OUT & AOUT,
    SCO & ASCO
  >;

  /** @deprecated please use createMiddleware() for the argument */
  public addMiddleware<
    AIN extends IOSchema<"strip">,
    AOUT extends FlatObject,
    ASCO extends string
  >(
    props: MiddlewareCreationProps<AIN, OUT, AOUT, ASCO>
  ): EndpointsFactory<
    POS,
    NEG,
    ProbableIntersection<IN, AIN>,
    OUT & AOUT,
    SCO & ASCO
  >;

  public addMiddleware<
    AIN extends IOSchema<"strip">,
    AOUT extends FlatObject,
    ASCO extends string
  >(
    subject:
      | MiddlewareDefinition<AIN, OUT, AOUT, ASCO>
      | MiddlewareCreationProps<AIN, OUT, AOUT, ASCO>
  ) {
    return EndpointsFactory.#create<
      POS,
      NEG,
      ProbableIntersection<IN, AIN>,
      OUT & AOUT,
      SCO & ASCO
    >(
      this.middlewares.concat(
        "type" in subject ? subject : createMiddleware(subject)
      ),
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
    const definition: AnyMiddlewareDef = {
      type: "express",
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
    };
    return EndpointsFactory.#create<POS, NEG, IN, OUT & AOUT, SCO>(
      this.middlewares.concat(definition),
      this.resultHandler
    );
  }

  public addOptions<AOUT extends FlatObject>(options: AOUT) {
    return EndpointsFactory.#create<POS, NEG, IN, OUT & AOUT, SCO>(
      this.middlewares.concat(
        createMiddleware({
          input: z.object({}),
          middleware: async () => options,
        })
      ),
      this.resultHandler
    );
  }

  public build<BIN extends IOSchema, BOUT extends IOSchema, M extends Method>({
    input,
    handler,
    description,
    output: outputSchema,
    ...rest
  }: BuildProps<BIN, BOUT, IN, OUT, M, SCO>): Endpoint<
    ProbableIntersection<IN, BIN>,
    BOUT,
    OUT,
    M,
    POS,
    NEG,
    SCO
  > {
    const { middlewares, resultHandler } = this;
    return new Endpoint({
      handler,
      description,
      middlewares,
      outputSchema,
      resultHandler,
      inputSchema: getFinalEndpointInputSchema<IN, BIN>(middlewares, input),
      mimeTypes: hasUpload(input) ? [mimeMultipart] : [mimeJson],
      ...rest,
    });
  }
}

export const defaultEndpointsFactory = new EndpointsFactory(
  defaultResultHandler
);
