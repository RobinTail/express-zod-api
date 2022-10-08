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
  SCO extends string,
  TAG extends string
> = {
  input: IN;
  output: OUT;
  handler: Handler<z.output<ProbableIntersection<MIN, IN>>, z.input<OUT>, OPT>;
  description?: string;
  scopes?: SCO[];
  tags?: TAG[];
} & MethodsDefinition<M>;

export class EndpointsFactory<
  POS extends ApiResponse,
  NEG extends ApiResponse,
  IN extends IOSchema<"strip"> | null = null,
  OUT extends FlatObject = {},
  SCO extends string = string,
  TAG extends string = string
> {
  protected middlewares: AnyMiddlewareDef[] = [];

  constructor(protected resultHandler: ResultHandlerDefinition<POS, NEG>) {}

  static #create<
    CPOS extends ApiResponse,
    CNEG extends ApiResponse,
    CIN extends IOSchema<"strip"> | null,
    COUT extends FlatObject,
    CSCO extends string,
    CTAG extends string
  >(
    middlewares: AnyMiddlewareDef[],
    resultHandler: ResultHandlerDefinition<CPOS, CNEG>
  ) {
    const factory = new EndpointsFactory<CPOS, CNEG, CIN, COUT, CSCO, CTAG>(
      resultHandler
    );
    factory.middlewares = middlewares;
    return factory;
  }

  // @todo consider no arguments fn with a type param
  public allowTags<ATAG extends string>({}:
    | ATAG[]
    | Readonly<[ATAG, ...ATAG[]]>) {
    return EndpointsFactory.#create<POS, NEG, IN, OUT, SCO, TAG & ATAG>(
      this.middlewares,
      this.resultHandler
    );
  }

  public addMiddleware<
    AIN extends IOSchema<"strip">,
    AOUT extends FlatObject,
    ASCO extends string
  >(subject: MiddlewareDefinition<AIN, OUT, AOUT, ASCO>) {
    return EndpointsFactory.#create<
      POS,
      NEG,
      ProbableIntersection<IN, AIN>,
      OUT & AOUT,
      SCO & ASCO,
      TAG
    >(this.middlewares.concat(subject), this.resultHandler);
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
    return EndpointsFactory.#create<POS, NEG, IN, OUT & AOUT, SCO, TAG>(
      this.middlewares.concat(definition),
      this.resultHandler
    );
  }

  public addOptions<AOUT extends FlatObject>(options: AOUT) {
    return EndpointsFactory.#create<POS, NEG, IN, OUT & AOUT, SCO, TAG>(
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
  }: BuildProps<BIN, BOUT, IN, OUT, M, SCO, TAG>): Endpoint<
    ProbableIntersection<IN, BIN>,
    BOUT,
    OUT,
    M,
    POS,
    NEG,
    SCO,
    TAG
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
