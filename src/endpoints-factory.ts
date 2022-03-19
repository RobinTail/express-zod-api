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
import type { Hkt } from "./hkt";
import { Method, MethodsDefinition } from "./method";
import {
  AnyMiddlewareDef,
  createMiddleware,
  ExpressMiddleware,
  ExpressMiddlewareFeatures,
  MiddlewareDefinition,
} from "./middleware";
import { mimeJson, mimeMultipart } from "./mime";
import { DefaultResultHandler, AbstractResultHandler } from "./result-handler";

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
  RH extends {
    new <T>(output: T): Hkt.Output<RH["hkt"], T>;
    hkt: Hkt<unknown, AbstractResultHandler<any>>;
  },
  IN extends IOSchema<"strip"> | null = null,
  OPT extends FlatObject = {}
> {
  protected middlewares: AnyMiddlewareDef[] = [];

  constructor(protected ResultHandler: RH) {}

  static #create<
    CRH extends {
      new <T>(output: T): Hkt.Output<CRH["hkt"], T>;
      hkt: Hkt<unknown, AbstractResultHandler<any>>;
    },
    CIN extends IOSchema<"strip"> | null,
    COPT extends FlatObject
  >(middlewares: AnyMiddlewareDef[], resultHandler: CRH) {
    const factory = new EndpointsFactory<CRH, CIN, COPT>(resultHandler);
    factory.middlewares = middlewares;
    return factory;
  }

  public addMiddleware<AIN extends IOSchema<"strip">, AOPT extends FlatObject>(
    definition: MiddlewareDefinition<AIN, OPT, AOPT>
  ) {
    return EndpointsFactory.#create<
      RH,
      ProbableIntersection<IN, AIN>,
      OPT & AOPT
    >(
      this.middlewares.concat(definition as unknown as AnyMiddlewareDef),
      this.ResultHandler
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
    return EndpointsFactory.#create<RH, IN, OPT & AOPT>(
      this.middlewares.concat(definition as AnyMiddlewareDef),
      this.ResultHandler
    );
  }

  public addOptions<AOPT extends FlatObject>(options: AOPT) {
    return EndpointsFactory.#create<RH, IN, OPT & AOPT>(
      this.middlewares.concat(
        createMiddleware({
          input: z.object({}),
          middleware: async () => options,
        }) as AnyMiddlewareDef
      ),
      this.ResultHandler
    );
  }

  public build<BIN extends IOSchema, BOUT extends IOSchema, M extends Method>({
    input,
    handler,
    description,
    output: outputSchema,
    ...rest
  }: BuildProps<BIN, BOUT, IN, OPT, M>) {
    const { middlewares, ResultHandler } = this;
    return new Endpoint({
      handler,
      description,
      middlewares,
      outputSchema,
      resultHandler: new ResultHandler(outputSchema),
      inputSchema: getFinalEndpointInputSchema<IN, BIN>(middlewares, input),
      mimeTypes: hasUpload(input) ? [mimeMultipart] : [mimeJson],
      ...rest,
    });
  }
}

export const defaultEndpointsFactory = new EndpointsFactory(
  DefaultResultHandler
);
