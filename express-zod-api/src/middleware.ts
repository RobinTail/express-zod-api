import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { EmptySchema, FlatObject } from "./common-helpers";
import { InputValidationError } from "./errors";
import { IOSchema } from "./io-schema";
import { LogicalContainer } from "./logical-container";
import { Security } from "./security";
import { ActualLogger } from "./logger-helpers";

type Handler<IN, OPT, OUT> = (params: {
  /** @desc The inputs from the enabled input sources validated against final input schema of the Middleware */
  input: IN;
  /**
   * @desc The returns of the previously executed Middlewares (typed when chaining Middlewares)
   * @link https://github.com/RobinTail/express-zod-api/discussions/1250
   * */
  options: OPT;
  /** @link https://expressjs.com/en/5x/api.html#req */
  request: Request;
  /** @link https://expressjs.com/en/5x/api.html#res */
  response: Response;
  /** @desc The instance of the configured logger */
  logger: ActualLogger;
}) => Promise<OUT>;

export abstract class AbstractMiddleware {
  /** @internal */
  public abstract get security(): LogicalContainer<Security> | undefined;
  /** @internal */
  public abstract get schema(): IOSchema<"strip">;
  public abstract execute(params: {
    input: unknown;
    options: FlatObject;
    request: Request;
    response: Response;
    logger: ActualLogger;
  }): Promise<FlatObject>;
}

export class Middleware<
  OPT extends FlatObject,
  OUT extends FlatObject,
  SCO extends string,
  IN extends IOSchema<"strip"> = EmptySchema,
> extends AbstractMiddleware {
  readonly #schema: IN;
  readonly #security?: LogicalContainer<
    Security<Extract<keyof z.input<IN>, string>, SCO>
  >;
  readonly #handler: Handler<z.output<IN>, OPT, OUT>;

  constructor({
    input = z.object({}) as IN,
    security,
    handler,
  }: {
    /**
     * @desc Input schema of the Middleware, combining properties from all the enabled input sources
     * @default z.object({})
     * @see defaultInputSources
     * */
    input?: IN;
    /** @desc Declaration of the security schemas implemented within the handler */
    security?: LogicalContainer<
      Security<Extract<keyof z.input<IN>, string>, SCO>
    >;
    /** @desc The handler returning options available to Endpoints */
    handler: Handler<z.output<IN>, OPT, OUT>;
  }) {
    super();
    this.#schema = input;
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
    options: OPT;
    request: Request;
    response: Response;
    logger: ActualLogger;
  }) {
    try {
      const validInput = (await this.#schema.parseAsync(input)) as z.output<IN>;
      return this.#handler({ ...rest, input: validInput });
    } catch (e) {
      throw e instanceof z.ZodError ? new InputValidationError(e) : e;
    }
  }
}

export class ExpressMiddleware<
  R extends Request,
  S extends Response,
  OUT extends FlatObject,
> extends Middleware<FlatObject, OUT, string> {
  constructor(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- issue #2824, assignment compatibility fix
    nativeMw: (request: R, response: S, next: NextFunction) => any,
    {
      provider = () => ({}) as OUT,
      transformer = (err: Error) => err,
    }: {
      provider?: (request: R, response: S) => OUT | Promise<OUT>;
      transformer?: (err: Error) => Error;
    } = {},
  ) {
    super({
      handler: async ({ request, response }) =>
        new Promise<OUT>((resolve, reject) => {
          const next = (err?: unknown) => {
            if (err && err instanceof Error) return reject(transformer(err));
            resolve(provider(request as R, response as S));
          };
          nativeMw(request as R, response as S, next)?.catch(next);
        }),
    });
  }
}
