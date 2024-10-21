import { Request, Response } from "express";
import { z } from "zod";
import { EmptyObject, FlatObject } from "./common-helpers";
import { CommonConfig } from "./config-type";
import { Endpoint, Handler } from "./endpoint";
import { IOSchema, getFinalEndpointInputSchema } from "./io-schema";
import { Method } from "./method";
import {
  AbstractMiddleware,
  ExpressMiddleware,
  Middleware,
} from "./middleware";
import {
  AbstractResultHandler,
  arrayResultHandler,
  defaultResultHandler,
} from "./result-handler";

type BuildProps<
  IN extends IOSchema,
  OUT extends IOSchema,
  MIN extends IOSchema<"strip">,
  OPT extends FlatObject,
  SCO extends string,
  TAG extends string,
> = {
  input: IN;
  output: OUT;
  handler: Handler<z.output<z.ZodIntersection<MIN, IN>>, z.input<OUT>, OPT>;
  description?: string;
  shortDescription?: string;
  operationId?: string | ((method: Method) => string);
} & ({ method: Method } | { methods: Method[] }) &
  ({ scopes?: SCO[] } | { scope?: SCO }) &
  ({ tags?: TAG[] } | { tag?: TAG });

export class EndpointsFactory<
  IN extends IOSchema<"strip"> = z.ZodObject<EmptyObject, "strip">,
  OUT extends FlatObject = EmptyObject,
  SCO extends string = string,
  TAG extends string = string,
> {
  protected resultHandler: AbstractResultHandler;
  protected middlewares: AbstractMiddleware[] = [];

  /** @desc Consider using the "config" prop with the "tags" option to enforce constraints on tagging the endpoints */
  constructor(resultHandler: AbstractResultHandler);
  constructor(params: {
    resultHandler: AbstractResultHandler;
    config?: CommonConfig<TAG>;
  });
  constructor(
    subject:
      | AbstractResultHandler
      | {
          resultHandler: AbstractResultHandler;
          config?: CommonConfig<TAG>;
        },
  ) {
    this.resultHandler =
      "resultHandler" in subject ? subject.resultHandler : subject;
  }

  static #create<
    CIN extends IOSchema<"strip">,
    COUT extends FlatObject,
    CSCO extends string,
    CTAG extends string,
  >(middlewares: AbstractMiddleware[], resultHandler: AbstractResultHandler) {
    const factory = new EndpointsFactory<CIN, COUT, CSCO, CTAG>(resultHandler);
    factory.middlewares = middlewares;
    return factory;
  }

  public addMiddleware<
    AIN extends IOSchema<"strip">,
    AOUT extends FlatObject,
    ASCO extends string,
  >(
    subject:
      | Middleware<AIN, OUT, AOUT, ASCO>
      | ConstructorParameters<typeof Middleware<AIN, OUT, AOUT, ASCO>>[0],
  ) {
    return EndpointsFactory.#create<
      z.ZodIntersection<IN, AIN>,
      OUT & AOUT,
      SCO & ASCO,
      TAG
    >(
      this.middlewares.concat(
        subject instanceof Middleware ? subject : new Middleware(subject),
      ),
      this.resultHandler,
    );
  }

  public use = this.addExpressMiddleware;

  public addExpressMiddleware<
    R extends Request,
    S extends Response,
    AOUT extends FlatObject = EmptyObject,
  >(...params: ConstructorParameters<typeof ExpressMiddleware<R, S, AOUT>>) {
    return EndpointsFactory.#create<IN, OUT & AOUT, SCO, TAG>(
      this.middlewares.concat(new ExpressMiddleware(...params)),
      this.resultHandler,
    );
  }

  public addOptions<AOUT extends FlatObject>(getOptions: () => Promise<AOUT>) {
    return EndpointsFactory.#create<IN, OUT & AOUT, SCO, TAG>(
      this.middlewares.concat(
        new Middleware({
          input: z.object({}),
          handler: getOptions,
        }),
      ),
      this.resultHandler,
    );
  }

  public build<BIN extends IOSchema, BOUT extends IOSchema>({
    input,
    handler,
    output: outputSchema,
    description,
    shortDescription,
    operationId,
    ...rest
  }: BuildProps<BIN, BOUT, IN, OUT, SCO, TAG>): Endpoint<
    z.ZodIntersection<IN, BIN>,
    BOUT,
    OUT,
    SCO,
    TAG
  > {
    const { middlewares, resultHandler } = this;
    const methods = "methods" in rest ? rest.methods : [rest.method];
    const getOperationId =
      typeof operationId === "function"
        ? operationId
        : (): string | undefined => operationId;
    const scopes =
      "scopes" in rest
        ? rest.scopes
        : "scope" in rest && rest.scope
          ? [rest.scope]
          : [];
    const tags =
      "tags" in rest ? rest.tags : "tag" in rest && rest.tag ? [rest.tag] : [];
    return new Endpoint({
      handler,
      middlewares,
      outputSchema,
      resultHandler,
      scopes,
      tags,
      methods,
      getOperationId,
      description,
      shortDescription,
      inputSchema: getFinalEndpointInputSchema<IN, BIN>(middlewares, input),
    });
  }
}

export const defaultEndpointsFactory = new EndpointsFactory(
  defaultResultHandler,
);

/**
 * @deprecated Resist the urge of using it: this factory is designed only to simplify the migration of legacy APIs.
 * @desc Responding with array is a bad practice keeping your endpoints from evolving without breaking changes.
 * @desc The result handler of this factory expects your endpoint to have the property 'items' in the output schema
 */
export const arrayEndpointsFactory = new EndpointsFactory(arrayResultHandler);
