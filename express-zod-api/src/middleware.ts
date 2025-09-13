import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { emptySchema, FlatObject } from "./common-helpers";
import { InputValidationError } from "./errors";
import { IOSchema } from "./io-schema";
import { LogicalContainer } from "./logical-container";
import { Security } from "./security";
import { ActualLogger } from "./logger-helpers";

type Handler<IN, CTX, RET> = (params: {
  /** @desc The inputs from the enabled input sources validated against the input schema of the Middleware */
  input: IN;
  /**
   * @desc The returns of the previously executed Middlewares (typed when chaining Middlewares)
   * @link https://github.com/RobinTail/express-zod-api/discussions/1250
   * */
  ctx: CTX;
  /**
   * @deprecated use ctx instead
   * @todo rm in v26
   * */
  options: CTX;
  /** @link https://expressjs.com/en/5x/api.html#req */
  request: Request;
  /** @link https://expressjs.com/en/5x/api.html#res */
  response: Response;
  /** @desc The instance of the configured logger */
  logger: ActualLogger;
}) => Promise<RET>;

export abstract class AbstractMiddleware {
  /** @internal */
  public abstract get security(): LogicalContainer<Security> | undefined;
  /** @internal */
  public abstract get schema(): IOSchema | undefined;
  public abstract execute(params: {
    input: unknown;
    ctx: FlatObject;
    request: Request;
    response: Response;
    logger: ActualLogger;
  }): Promise<FlatObject>;
}

export class Middleware<
  CTX extends FlatObject,
  RET extends FlatObject,
  SCO extends string,
  IN extends IOSchema | undefined = undefined,
> extends AbstractMiddleware {
  readonly #schema: IN;
  readonly #security?: LogicalContainer<
    Security<Extract<keyof z.input<IN>, string>, SCO>
  >;
  readonly #handler: Handler<z.output<IN>, CTX, RET>;

  constructor({
    input,
    security,
    handler,
  }: {
    /**
     * @desc Input schema of the Middleware, combining properties from all the enabled input sources
     * @default undefined
     * @see defaultInputSources
     * */
    input?: IN;
    /** @desc Declaration of the security schemas implemented within the handler */
    security?: LogicalContainer<
      Security<Extract<keyof z.input<IN>, string>, SCO>
    >;
    /** @desc The handler returning a context available to Endpoints */
    handler: Handler<z.output<IN>, CTX, RET>;
  }) {
    super();
    this.#schema = input as IN;
    this.#security = security;
    this.#handler = handler;
  }

  /** @internal */
  public override get security() {
    return this.#security;
  }

  /** @internal */
  public override get schema() {
    return this.#schema;
  }

  /** @throws InputValidationError */
  public override async execute({
    input,
    ...rest
  }: {
    input: unknown;
    ctx: CTX;
    request: Request;
    response: Response;
    logger: ActualLogger;
  }) {
    try {
      const validInput = (await (this.#schema || emptySchema).parseAsync(
        input,
      )) as z.output<IN>;
      /** @todo rm options in v26 */
      return this.#handler({ ...rest, input: validInput, options: rest.ctx });
    } catch (e) {
      throw e instanceof z.ZodError ? new InputValidationError(e) : e;
    }
  }
}

export class ExpressMiddleware<
  R extends Request,
  S extends Response,
  RET extends FlatObject,
> extends Middleware<FlatObject, RET, string> {
  constructor(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- issue #2824, assignment compatibility fix
    nativeMw: (request: R, response: S, next: NextFunction) => any,
    {
      provider = () => ({}) as RET,
      transformer = (err: Error) => err,
    }: {
      provider?: (request: R, response: S) => RET | Promise<RET>;
      transformer?: (err: Error) => Error;
    } = {},
  ) {
    super({
      handler: async ({ request, response }) =>
        new Promise<RET>((resolve, reject) => {
          const next = (err?: unknown) => {
            if (err && err instanceof Error) return reject(transformer(err));
            resolve(provider(request as R, response as S));
          };
          nativeMw(request as R, response as S, next)?.catch(next);
        }),
    });
  }
}
