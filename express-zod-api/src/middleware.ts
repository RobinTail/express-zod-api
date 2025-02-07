import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { EmptySchema, FlatObject } from "./common-helpers";
import { InputValidationError } from "./errors";
import { IOSchema } from "./io-schema";
import { LogicalContainer } from "./logical-container";
import { Security } from "./security";
import { ActualLogger } from "./logger-helpers";

type Handler<IN, OPT, OUT> = (params: {
  input: IN;
  options: OPT;
  request: Request;
  response: Response;
  logger: ActualLogger;
}) => Promise<OUT>;

export abstract class AbstractMiddleware {
  public abstract getSecurity(): LogicalContainer<Security> | undefined;
  public abstract getSchema(): IOSchema<"strip">;
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
    input?: IN;
    security?: LogicalContainer<
      Security<Extract<keyof z.input<IN>, string>, SCO>
    >;
    handler: Handler<z.output<IN>, OPT, OUT>;
  }) {
    super();
    this.#schema = input;
    this.#security = security;
    this.#handler = handler;
  }

  public override getSecurity() {
    return this.#security;
  }

  public override getSchema() {
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
    nativeMw: (
      request: R,
      response: S,
      next: NextFunction,
    ) => void | Promise<void>,
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
