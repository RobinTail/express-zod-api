import { Request, Response } from "express";
import { z } from "zod";
import { NormalizedResponse, ResponseVariant } from "./api-response";
import { hasRaw, hasUpload } from "./deep-checks";
import {
  FlatObject,
  getActualMethod,
  getInput,
  ensureError,
} from "./common-helpers";
import { CommonConfig } from "./config-type";
import {
  InputValidationError,
  OutputValidationError,
  ResultHandlerError,
} from "./errors";
import { IOSchema } from "./io-schema";
import { lastResortHandler } from "./last-resort";
import { ActualLogger } from "./logger-helpers";
import { LogicalContainer } from "./logical-container";
import { AuxMethod, Method } from "./method";
import { AbstractMiddleware, ExpressMiddleware } from "./middleware";
import { ContentType } from "./content-type";
import { Routable } from "./routable";
import { AbstractResultHandler } from "./result-handler";
import { Security } from "./security";

export type Handler<IN, OUT, OPT> = (params: {
  input: IN;
  options: OPT;
  logger: ActualLogger;
}) => Promise<OUT>;

type DescriptionVariant = "short" | "long";
type IOVariant = "input" | "output";

// @todo consider getters in v23
export abstract class AbstractEndpoint extends Routable {
  public abstract execute(params: {
    request: Request;
    response: Response;
    logger: ActualLogger;
    config: CommonConfig;
  }): Promise<void>;
  public abstract getDescription(
    variant: DescriptionVariant,
  ): string | undefined;
  public abstract getMethods(): ReadonlyArray<Method> | undefined;
  public abstract getSchema(variant: IOVariant): IOSchema;
  public abstract getResponses(
    variant: ResponseVariant,
  ): ReadonlyArray<NormalizedResponse>;
  // @todo should return ReadonlyArray
  public abstract getSecurity(): LogicalContainer<Security>[];
  public abstract getScopes(): ReadonlyArray<string>;
  public abstract getTags(): ReadonlyArray<string>;
  public abstract getOperationId(method: Method): string | undefined;
  public abstract getRequestType(): ContentType;
}

export class Endpoint<
  IN extends IOSchema,
  OUT extends IOSchema,
  OPT extends FlatObject,
> extends AbstractEndpoint {
  readonly #descriptions: Record<DescriptionVariant, string | undefined>;
  readonly #methods?: Method[];
  readonly #middlewares: AbstractMiddleware[];
  readonly #handler: Handler<z.output<IN>, z.input<OUT>, OPT>;
  readonly #resultHandler: AbstractResultHandler;
  readonly #schemas: { input: IN; output: OUT };
  readonly #scopes: string[];
  readonly #tags: string[];
  readonly #getOperationId: (method: Method) => string | undefined;

  constructor({
    methods,
    inputSchema,
    outputSchema,
    handler,
    resultHandler,
    getOperationId = () => undefined,
    scopes = [],
    middlewares = [],
    tags = [],
    description: long,
    shortDescription: short,
  }: {
    middlewares?: AbstractMiddleware[];
    inputSchema: IN;
    outputSchema: OUT;
    handler: Handler<z.output<IN>, z.input<OUT>, OPT>;
    resultHandler: AbstractResultHandler;
    description?: string;
    shortDescription?: string;
    getOperationId?: (method: Method) => string | undefined;
    methods?: Method[];
    scopes?: string[];
    tags?: string[];
  }) {
    super();
    this.#handler = handler;
    this.#resultHandler = resultHandler;
    this.#middlewares = middlewares;
    this.#getOperationId = getOperationId;
    this.#methods = methods;
    this.#scopes = scopes;
    this.#tags = tags;
    this.#descriptions = { long, short };
    this.#schemas = { input: inputSchema, output: outputSchema };
  }

  public override clone() {
    return new Endpoint({
      methods: this.#methods,
      inputSchema: this.#schemas.input,
      outputSchema: this.#schemas.output,
      handler: this.#handler,
      resultHandler: this.#resultHandler,
      getOperationId: this.#getOperationId,
      scopes: this.#scopes,
      middlewares: this.#middlewares,
      tags: this.#tags,
      description: this.#descriptions.long,
      shortDescription: this.#descriptions.short,
    }) as this;
  }

  public override getDescription(variant: DescriptionVariant) {
    return this.#descriptions[variant];
  }

  public override getMethods() {
    return Object.freeze(this.#methods);
  }

  public override getSchema(variant: "input"): IN;
  public override getSchema(variant: "output"): OUT;
  public override getSchema(variant: IOVariant) {
    return this.#schemas[variant];
  }

  public override getRequestType() {
    return hasUpload(this.#schemas.input)
      ? "upload"
      : hasRaw(this.#schemas.input)
        ? "raw"
        : "json";
  }

  public override getResponses(variant: ResponseVariant) {
    return Object.freeze(
      variant === "negative"
        ? this.#resultHandler.getNegativeResponse()
        : this.#resultHandler.getPositiveResponse(this.#schemas.output),
    );
  }

  public override getSecurity() {
    return this.#middlewares
      .map((middleware) => middleware.getSecurity())
      .filter((entry) => entry !== undefined);
  }

  public override getScopes() {
    return Object.freeze(this.#scopes);
  }

  public override getTags() {
    return Object.freeze(this.#tags);
  }

  public override getOperationId(method: Method): string | undefined {
    return this.#getOperationId(method);
  }

  async #parseOutput(output: z.input<OUT>) {
    try {
      return (await this.#schemas.output.parseAsync(output)) as FlatObject;
    } catch (e) {
      throw e instanceof z.ZodError ? new OutputValidationError(e) : e;
    }
  }

  async #runMiddlewares({
    method,
    logger,
    options,
    response,
    ...rest
  }: {
    method: Method | AuxMethod;
    input: Readonly<FlatObject>; // Issue #673: input is immutable, since this.inputSchema is combined with ones of middlewares
    request: Request;
    response: Response;
    logger: ActualLogger;
    options: Partial<OPT>;
  }) {
    for (const mw of this.#middlewares) {
      if (method === "options" && !(mw instanceof ExpressMiddleware)) continue;
      Object.assign(
        options,
        await mw.execute({ ...rest, options, response, logger }),
      );
      if (response.writableEnded) {
        logger.warn(
          "A middleware has closed the stream. Accumulated options:",
          options,
        );
        break;
      }
    }
  }

  async #parseAndRunHandler({
    input,
    ...rest
  }: {
    input: Readonly<FlatObject>;
    options: OPT;
    logger: ActualLogger;
  }) {
    let finalInput: z.output<IN>; // final input types transformations for handler
    try {
      finalInput = (await this.#schemas.input.parseAsync(
        input,
      )) as z.output<IN>;
    } catch (e) {
      throw e instanceof z.ZodError ? new InputValidationError(e) : e;
    }
    return this.#handler({ ...rest, input: finalInput });
  }

  async #handleResult({
    error,
    ...rest
  }: {
    error: Error | null;
    request: Request;
    response: Response;
    logger: ActualLogger;
    input: FlatObject;
    output: FlatObject | null;
    options: Partial<OPT>;
  }) {
    try {
      await this.#resultHandler.execute({ ...rest, error });
    } catch (e) {
      lastResortHandler({
        ...rest,
        error: new ResultHandlerError(ensureError(e), error || undefined),
      });
    }
  }

  public override async execute({
    request,
    response,
    logger,
    config,
  }: {
    request: Request;
    response: Response;
    logger: ActualLogger;
    config: CommonConfig;
  }) {
    const method = getActualMethod(request);
    const options: Partial<OPT> = {};
    let output: FlatObject | null = null;
    let error: Error | null = null;
    const input = getInput(request, config.inputSources);
    try {
      await this.#runMiddlewares({
        method,
        input,
        request,
        response,
        logger,
        options,
      });
      if (response.writableEnded) return;
      if (method === "options") return void response.status(200).end();
      output = await this.#parseOutput(
        await this.#parseAndRunHandler({
          input,
          logger,
          options: options as OPT, // ensured the complete OPT by writableEnded condition and try-catch
        }),
      );
    } catch (e) {
      error = ensureError(e);
    }
    await this.#handleResult({
      input,
      output,
      request,
      response,
      error,
      logger,
      options,
    });
  }
}
