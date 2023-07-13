import { Request, Response } from "express";
import { z } from "zod";
import { FlatObject } from "./common-helpers";
import { CommonConfig } from "./config-type";
import { Endpoint, Handler } from "./endpoint";
import {
  IOSchema,
  ProbableIntersection,
  getFinalEndpointInputSchema,
} from "./io-schema";
import { Method, MethodsDefinition } from "./method";
import {
  AnyMiddlewareDef,
  ExpressMiddleware,
  ExpressMiddlewareFeatures,
  MiddlewareDefinition,
  createMiddleware,
} from "./middleware";
import {
  ResultHandlerDefinition,
  defaultResultHandler,
} from "./result-handler";

type BuildProps<
  IN extends IOSchema,
  OUT extends IOSchema,
  MIN extends IOSchema<"strip"> | null,
  OPT extends FlatObject,
  M extends Method,
  SCO extends string,
  TAG extends string,
> = {
  input: IN;
  output: OUT;
  handler: Handler<z.output<ProbableIntersection<MIN, IN>>, z.input<OUT>, OPT>;
  description?: string;
  shortDescription?: string;
} & ({ scopes?: SCO[] } | { scope?: SCO }) &
  ({ tags?: TAG[] } | { tag?: TAG }) &
  MethodsDefinition<M>;

export class EndpointsFactory<
  POS extends z.ZodTypeAny,
  NEG extends z.ZodTypeAny,
  IN extends IOSchema<"strip"> | null = null,
  OUT extends FlatObject = {},
  SCO extends string = string,
  TAG extends string = string,
> {
  protected resultHandler: ResultHandlerDefinition<POS, NEG>;
  protected middlewares: AnyMiddlewareDef[] = [];

  constructor(resultHandler: ResultHandlerDefinition<POS, NEG>);
  /** @desc Consider using the "config" prop with the "tags" option to enforce constraints on tagging the endpoints */
  constructor(params: {
    resultHandler: ResultHandlerDefinition<POS, NEG>;
    config?: CommonConfig<TAG>;
  });
  constructor(
    subject:
      | ResultHandlerDefinition<POS, NEG>
      | {
          resultHandler: ResultHandlerDefinition<POS, NEG>;
          config?: CommonConfig<TAG>;
        },
  ) {
    this.resultHandler =
      "resultHandler" in subject ? subject.resultHandler : subject;
  }

  static #create<
    CPOS extends z.ZodTypeAny,
    CNEG extends z.ZodTypeAny,
    CIN extends IOSchema<"strip"> | null,
    COUT extends FlatObject,
    CSCO extends string,
    CTAG extends string,
  >(
    middlewares: AnyMiddlewareDef[],
    resultHandler: ResultHandlerDefinition<CPOS, CNEG>,
  ) {
    const factory = new EndpointsFactory<CPOS, CNEG, CIN, COUT, CSCO, CTAG>(
      resultHandler,
    );
    factory.middlewares = middlewares;
    return factory;
  }

  public addMiddleware<
    AIN extends IOSchema<"strip">,
    AOUT extends FlatObject,
    ASCO extends string,
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
    AOUT extends FlatObject = {},
  >(
    middleware: ExpressMiddleware<R, S>,
    features?: ExpressMiddlewareFeatures<R, S, AOUT>,
  ) {
    const transformer = features?.transformer || ((err: Error) => err);
    const provider = features?.provider || (() => ({}) as AOUT);
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
      this.resultHandler,
    );
  }

  public addOptions<AOUT extends FlatObject>(options: AOUT) {
    return EndpointsFactory.#create<POS, NEG, IN, OUT & AOUT, SCO, TAG>(
      this.middlewares.concat(
        createMiddleware({
          input: z.object({}),
          middleware: async () => options,
        }),
      ),
      this.resultHandler,
    );
  }

  public build<BIN extends IOSchema, BOUT extends IOSchema, M extends Method>({
    input,
    handler,
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
      middlewares,
      outputSchema,
      resultHandler,
      inputSchema: getFinalEndpointInputSchema<IN, BIN>(middlewares, input),
      ...rest,
    });
  }
}

export const defaultEndpointsFactory = new EndpointsFactory(
  defaultResultHandler,
);
