import { Request, Response } from "express";
import { z } from "zod";
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
  M extends Method
> = {
  input: IN;
  output: OUT;
  handler: Handler<z.output<ProbableIntersection<MIN, IN>>, z.input<OUT>, OPT>;
  description?: string;
} & MethodsDefinition<M>;

export class EndpointsFactory<
  POS extends <OUT extends IOSchema>(output: OUT) => z.ZodTypeAny,
  NEG extends z.ZodTypeAny,
  IN extends IOSchema<"strip"> | null = null,
  OPT extends FlatObject = {}
> {
  protected middlewares: AnyMiddlewareDef[] = [];

  constructor(protected resultHandler: ResultHandlerDefinition<POS, NEG>) {}

  static #create<
    CPOS extends <OUT extends IOSchema>(output: OUT) => z.ZodTypeAny,
    CNEG extends z.ZodTypeAny,
    CIN extends IOSchema<"strip"> | null,
    COPT extends FlatObject
  >(
    middlewares: AnyMiddlewareDef[],
    resultHandler: ResultHandlerDefinition<CPOS, CNEG>
  ) {
    const factory = new EndpointsFactory<CPOS, CNEG, CIN, COPT>(resultHandler);
    factory.middlewares = middlewares;
    return factory;
  }

  public addMiddleware<AIN extends IOSchema<"strip">, AOPT extends FlatObject>(
    definition: MiddlewareDefinition<AIN, OPT, AOPT>
  ) {
    return EndpointsFactory.#create<
      POS,
      NEG,
      ProbableIntersection<IN, AIN>,
      OPT & AOPT
    >(
      this.middlewares.concat(definition as unknown as AnyMiddlewareDef),
      this.resultHandler
    );
  }

  public use = this.addExpressMiddleware;

  public addExpressMiddleware<
    R extends Request,
    S extends Response,
    AOPT extends FlatObject = {}
  >(
    middleware: ExpressMiddleware<R, S>,
    features?: ExpressMiddlewareFeatures<R, S, AOPT>
  ) {
    const transformer = features?.transformer || ((err: Error) => err);
    const provider = features?.provider || (() => ({} as AOPT));
    const definition = createMiddleware({
      input: z.object({}),
      middleware: async ({ request, response }) =>
        new Promise<AOPT>((resolve, reject) => {
          const next = (err?: any) => {
            if (err && err instanceof Error) {
              return reject(transformer(err));
            }
            resolve(provider(request as R, response as S));
          };
          middleware(request as R, response as S, next);
        }),
    });
    return EndpointsFactory.#create<POS, NEG, IN, OPT & AOPT>(
      this.middlewares.concat(definition as AnyMiddlewareDef),
      this.resultHandler
    );
  }

  public addOptions<AOPT extends FlatObject>(options: AOPT) {
    return EndpointsFactory.#create<POS, NEG, IN, OPT & AOPT>(
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
    handler,
    description,
    output: outputSchema,
    ...rest
  }: BuildProps<BIN, BOUT, IN, OPT, M>) {
    const { middlewares, resultHandler } = this;
    return new Endpoint<ProbableIntersection<IN, BIN>, BOUT, OPT, M, POS, NEG>({
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
