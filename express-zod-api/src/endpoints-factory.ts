import type { Request, Response } from "express";
import { z } from "zod";
import {
  emptySchema,
  type EmptyObject,
  type EmptySchema,
  type FlatObject,
  type Tag,
} from "./common-helpers";
import { Endpoint, type Handler } from "./endpoint";
import {
  ensureExtension,
  makeFinalInputSchema,
  type IOSchema,
  type FinalInputSchema,
  type Extension,
} from "./io-schema";
import type { ClientMethod, Method } from "./method";
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
import { createCacheMiddleware } from "./cache-middleware";
import { createCookieMiddleware } from "./cookie-middleware";

interface BuildProps<
  IN extends IOSchema,
  OUT extends IOSchema | z.ZodVoid,
  MIN extends IOSchema | undefined,
  CTX extends FlatObject,
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
  /** @desc The Endpoint handler receiving the validated inputs, returns of added Middlewares (ctx) and a logger */
  handler: Handler<z.output<FinalInputSchema<MIN, IN>>, z.input<OUT>, CTX>;
  /** @desc The operation description for the generated Documentation (may use Markdown) */
  description?: string;
  /** @desc The operation summary for the generated Documentation (short plain string) */
  summary?: string;
  /** @desc The operation ID for the generated Documentation (must be unique) */
  operationId?: string | ((method: ClientMethod) => string);
  /**
   * @desc HTTP method(s) this endpoint can handle
   * @default "get" unless method is explicitly defined in Routing keys
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

/**
 * @desc Creates a factory for building Endpoints. It can be extended by adding Middlewares that enrich the context
 *       available to the Endpoint handler. It requires a ResultHandler to respond consistently.
 * @see Middleware
 * @see ResultHandler
 * */
export class EndpointsFactory<
  IN extends IOSchema | undefined = undefined,
  CTX extends FlatObject = EmptyObject,
  SCO extends string = string,
> {
  protected schema = undefined as IN;
  protected middlewares: AbstractMiddleware[] = [];

  /**
   * @param resultHandler An instance of ResultHandler for handling both Endpoint outputs and all possible errors.
   * @see ResultHandler
   * */
  constructor(protected resultHandler: AbstractResultHandler) {}

  #extend<
    AIN extends IOSchema | undefined,
    RET extends FlatObject,
    ASCO extends string,
  >(middleware: Middleware<CTX, RET, ASCO, AIN>) {
    const factory = new EndpointsFactory<
      Extension<IN, AIN>,
      (CTX extends EmptyObject ? RET : CTX) & RET,
      SCO & ASCO
    >(this.resultHandler);
    factory.middlewares = this.middlewares.concat(middleware);
    factory.schema = ensureExtension(this.schema, middleware.schema);
    return factory;
  }

  /**
   * @desc Attaches a Middleware to the factory, extending the context available to Endpoints built on it.
   *       Accepts either a Middleware instance or a plain object compatible with the Middleware constructor.
   * @see Middleware
   * */
  public addMiddleware<
    RET extends FlatObject,
    ASCO extends string,
    AIN extends IOSchema | undefined = undefined,
  >(
    subject:
      | Middleware<CTX, RET, ASCO, AIN>
      | ConstructorParameters<typeof Middleware<CTX, RET, ASCO, AIN>>[0],
  ) {
    return this.#extend(
      subject instanceof Middleware ? subject : new Middleware(subject),
    );
  }

  /** @desc Shorthand for .addMiddleware(createCookieMiddleware()) */
  public useCookies(...args: Parameters<typeof createCookieMiddleware>) {
    return this.#extend(createCookieMiddleware(...args));
  }

  /** @desc Shorthand for .addMiddleware(createCacheMiddleware()) */
  public useCache(...args: Parameters<typeof createCacheMiddleware>) {
    return this.#extend(createCacheMiddleware(...args));
  }

  /**
   * @desc Shorthand for addExpressMiddleware(). Use it for wrapping native Express middlewares.
   * @see addExpressMiddleware
   * */
  public use = this.addExpressMiddleware;

  /**
   * @desc Wraps a native Express middleware and attaches it to the factory as a Middleware. Optionally, a `provider`
   *       can extract context properties from the request and response, and a `transformer` can convert errors.
   * @see ExpressMiddleware
   * */
  public addExpressMiddleware<
    R extends Request,
    S extends Response,
    AOUT extends FlatObject = EmptyObject,
  >(...params: ConstructorParameters<typeof ExpressMiddleware<R, S, AOUT>>) {
    return this.#extend(new ExpressMiddleware(...params));
  }

  /**
   * @desc Extends the context available to Endpoints built on this factory by resolving additional properties
   *       from an asynchronous callback. The callback receives the current accumulated context, allowing further
   *       context values to depend on previously provided ones. This is a shorthand for addMiddleware() with no schema.
   * @see addMiddleware
   * */
  public addContext<RET extends FlatObject>(
    provider: (current: CTX) => Promise<RET>,
  ) {
    return this.#extend(
      new Middleware({ handler: ({ ctx }) => provider(ctx) }),
    );
  }

  /**
   * @desc Builds an Endpoint using the accumulated Middlewares, the ResultHandler, and the given configuration.
   *       The output is validated against the output schema; the handler receives the validated input and context.
   * @see Endpoint
   * */
  public build<BOUT extends IOSchema, BIN extends IOSchema = EmptySchema>({
    input = emptySchema as unknown as BIN,
    output: outputSchema,
    operationId,
    scope,
    tag,
    method,
    ...rest
  }: BuildProps<BIN, BOUT, IN, CTX, SCO>) {
    const { middlewares, resultHandler } = this;
    const methods = typeof method === "string" ? [method] : method;
    const getOperationId =
      typeof operationId === "function"
        ? operationId
        : (mtd: ClientMethod) =>
            operationId && `${operationId}${mtd === "head" ? "__HEAD" : ""}`; // ensure non-breaking change
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
      inputSchema: makeFinalInputSchema(this.schema, input),
    });
  }

  /**
   * @desc shorthand for build() having output schema assigned with an empty object
   * @see build
   * */
  public buildVoid<BIN extends IOSchema = EmptySchema>({
    handler,
    ...rest
  }: Omit<BuildProps<BIN, z.ZodVoid, IN, CTX, SCO>, "output">) {
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

/**
 * @desc The factory based on the default ResultHandler: suitable for JSON responses.
 * @see defaultResultHandler
 * */
export const defaultEndpointsFactory = new EndpointsFactory(
  defaultResultHandler,
);

/**
 * @deprecated Resist the urge of using it: this factory is designed only to simplify the migration of legacy APIs.
 * @desc Responding with an array is a bad practice keeping your endpoints from evolving without breaking changes.
 * @desc The result handler of this factory expects your endpoint to have the property 'items' in the output schema
 */
export const arrayEndpointsFactory = new EndpointsFactory(arrayResultHandler);
