import { Request, Response } from "express";
import { z } from "zod/v4";
import {
  EmptyObject,
  emptySchema,
  EmptySchema,
  FlatObject,
  Tag,
} from "./common-helpers";
import { Endpoint, Handler } from "./endpoint";
import {
  IOSchema,
  getFinalEndpointInputSchema,
  ConditionalIntersection,
  SelectiveIntersection,
} from "./io-schema";
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

interface BuildProps<
  IN extends IOSchema,
  OUT extends IOSchema | z.ZodVoid,
  MIN extends IOSchema | undefined,
  OPT extends FlatObject,
  SCO extends string,
> {
  /**
   * @desc Input schema of the Endpoint, combining properties from all the enabled input sources (path params, headers)
   * @default z.object({})
   * @see defaultInputSources
   * */
  input?: IN;
  /** @desc The schema by which the returns of the Endpoint handler is validated */
  output: OUT;
  /** @desc The Endpoint handler receiving the validated inputs, returns of added Middlewares (options) and a logger */
  handler: Handler<
    z.output<ConditionalIntersection<MIN, IN>>,
    z.input<OUT>,
    OPT
  >;
  /** @desc The operation description for the generated Documentation */
  description?: string;
  /** @desc The operation summary for the generated Documentation (50 symbols max) */
  shortDescription?: string;
  /** @desc The operation ID for the generated Documentation (must be unique) */
  operationId?: string | ((method: Method) => string);
  /**
   * @desc HTTP method(s) this endpoint can handle
   * @default "get" unless the Endpoint is assigned within DependsOnMethod
   * @see DependsOnMethod
   * */
  method?: Method | [Method, ...Method[]];
  /**
   * @desc Scope(s) from the list of the ones defined by the added Middlewares having "oauth2" security type
   * @see OAuth2Security
   * */
  scope?: SCO | SCO[];
  /**
   * @desc Tag(s) for generating Documentation. For establishing constraints:
   * @see TagOverrides
   * */
  tag?: Tag | Tag[];
  /** @desc Marks the operation deprecated in the generated Documentation */
  deprecated?: boolean;
}

export class EndpointsFactory<
  IN extends IOSchema | undefined = undefined,
  OUT extends FlatObject = EmptyObject,
  SCO extends string = string,
> {
  protected middlewares: AbstractMiddleware[] = [];
  constructor(protected resultHandler: AbstractResultHandler) {}

  #create<
    CIN extends IOSchema | undefined,
    COUT extends FlatObject,
    CSCO extends string,
  >(middleware: AbstractMiddleware) {
    const factory = new EndpointsFactory<CIN, COUT, CSCO>(this.resultHandler);
    factory.middlewares = this.middlewares.concat(middleware);
    return factory;
  }

  public addMiddleware<
    AOUT extends FlatObject,
    ASCO extends string,
    AIN extends IOSchema | undefined = undefined,
  >(
    subject:
      | Middleware<OUT, AOUT, ASCO, AIN>
      | ConstructorParameters<typeof Middleware<OUT, AOUT, ASCO, AIN>>[0],
  ) {
    return this.#create<SelectiveIntersection<IN, AIN>, OUT & AOUT, SCO & ASCO>(
      subject instanceof Middleware ? subject : new Middleware(subject),
    );
  }

  public use = this.addExpressMiddleware;

  public addExpressMiddleware<
    R extends Request,
    S extends Response,
    AOUT extends FlatObject = EmptyObject,
  >(...params: ConstructorParameters<typeof ExpressMiddleware<R, S, AOUT>>) {
    return this.#create<IN, OUT & AOUT, SCO>(new ExpressMiddleware(...params));
  }

  public addOptions<AOUT extends FlatObject>(getOptions: () => Promise<AOUT>) {
    return this.#create<IN, OUT & AOUT, SCO>(
      new Middleware({ handler: getOptions }),
    );
  }

  public build<BOUT extends IOSchema, BIN extends IOSchema = EmptySchema>({
    input = emptySchema as unknown as BIN,
    output: outputSchema,
    operationId,
    scope,
    tag,
    method,
    ...rest
  }: BuildProps<BIN, BOUT, IN, OUT, SCO>) {
    const { middlewares, resultHandler } = this;
    const methods = typeof method === "string" ? [method] : method;
    const getOperationId =
      typeof operationId === "function" ? operationId : () => operationId;
    const scopes = typeof scope === "string" ? [scope] : scope || [];
    const tags = typeof tag === "string" ? [tag] : tag || [];
    return new Endpoint({
      ...rest,
      middlewares,
      outputSchema,
      resultHandler,
      scopes,
      tags,
      methods,
      getOperationId,
      inputSchema: getFinalEndpointInputSchema<IN, BIN>(middlewares, input),
    });
  }

  /** @desc shorthand for returning {} while having output schema z.object({}) */
  public buildVoid<BIN extends IOSchema = EmptySchema>({
    handler,
    ...rest
  }: Omit<BuildProps<BIN, z.ZodVoid, IN, OUT, SCO>, "output">) {
    return this.build({
      ...rest,
      output: emptySchema,
      handler: async (props) => {
        await handler(props);
        return {};
      },
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
