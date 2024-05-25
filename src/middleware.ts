import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { hasTransformationOnTop } from "./deep-checks";
import { EmptyObject, FlatObject } from "./common-helpers";
import { InputValidationError, IOSchemaError } from "./errors";
import { IOSchema } from "./io-schema";
import { LogicalContainer } from "./logical-container";
import { Security } from "./security";
import { ActualLogger } from "./logger-helpers";
import assert from "node:assert/strict";

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

export interface MiddlewareCreationProps<
  IN extends IOSchema<"strip">,
  OPT extends FlatObject,
  OUT extends FlatObject,
  SCO extends string,
> {
  input: IN;
  security?: LogicalContainer<
    Security<Extract<keyof z.input<IN>, string>, SCO>
  >;
  handler: Handler<z.output<IN>, OPT, OUT>;
}

export class Middleware<
  IN extends IOSchema<"strip">,
  OPT extends FlatObject,
  OUT extends FlatObject,
  SCO extends string,
> extends AbstractMiddleware {
  readonly #input: IN;
  readonly #security?: LogicalContainer<
    Security<Extract<keyof z.input<IN>, string>, SCO>
  >;
  readonly #handler: Handler<z.output<IN>, OPT, OUT>;

  constructor({
    input,
    security,
    handler,
  }: MiddlewareCreationProps<IN, OPT, OUT, SCO>) {
    super();
    assert(
      !hasTransformationOnTop(input),
      new IOSchemaError(
        "Using transformations on the top level of middleware input schema is not allowed.",
      ),
    );
    this.#input = input;
    this.#security = security;
    this.#handler = handler;
  }

  public override getSecurity() {
    return this.#security;
  }

  public override getSchema() {
    return this.#input;
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
      const validInput = (await this.#input.parseAsync(input)) as z.output<IN>;
      return this.#handler({ ...rest, input: validInput });
    } catch (e) {
      if (e instanceof z.ZodError) {
        throw new InputValidationError(e);
      }
      throw e;
    }
  }
}

export class ExpressMiddleware<
  R extends Request,
  S extends Response,
  OUT extends FlatObject,
> extends Middleware<
  z.ZodObject<EmptyObject, "strip">,
  FlatObject,
  OUT,
  string
> {
  constructor(
    originalMw: (
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
      input: z.object({}),
      handler: async ({ request, response }) =>
        new Promise<OUT>((resolve, reject) => {
          const next = (err?: unknown) => {
            if (err && err instanceof Error) {
              return reject(transformer(err));
            }
            resolve(provider(request as R, response as S));
          };
          originalMw(request as R, response as S, next);
        }),
    });
  }
}
