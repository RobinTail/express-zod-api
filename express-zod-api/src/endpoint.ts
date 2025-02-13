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
  public abstract get isDeprecated(): boolean;
}

export class Endpoint<
  IN extends IOSchema,
  OUT extends IOSchema,
  OPT extends FlatObject,
> extends AbstractEndpoint {
  readonly #def: ConstructorParameters<typeof Endpoint<IN, OUT, OPT>>[0];

  constructor(def: {
    isDeprecated?: boolean;
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
    this.#def = def;
  }

  #clone(
    inc?: Partial<ConstructorParameters<typeof Endpoint<IN, OUT, OPT>>[0]>,
  ) {
    return new Endpoint({ ...this.#def, ...inc });
  }

  public override deprecated() {
    return this.#clone({ isDeprecated: true }) as this;
  }

  public override get isDeprecated(): boolean {
    return this.#def.isDeprecated || false;
  }

  public override getDescription(variant: DescriptionVariant) {
    return this.#def[variant === "short" ? "shortDescription" : "description"];
  }

  public override getMethods() {
    return Object.freeze(this.#def.methods);
  }

  public override getSchema(variant: "input"): IN;
  public override getSchema(variant: "output"): OUT;
  public override getSchema(variant: IOVariant) {
    return this.#def[variant === "output" ? "outputSchema" : "inputSchema"];
  }

  public override getRequestType() {
    return hasUpload(this.#def.inputSchema)
      ? "upload"
      : hasRaw(this.#def.inputSchema)
        ? "raw"
        : "json";
  }

  public override getResponses(variant: ResponseVariant) {
    return Object.freeze(
      variant === "negative"
        ? this.#def.resultHandler.getNegativeResponse()
        : this.#def.resultHandler.getPositiveResponse(this.#def.outputSchema),
    );
  }

  public override getSecurity() {
    return (this.#def.middlewares || [])
      .map((middleware) => middleware.getSecurity())
      .filter((entry) => entry !== undefined);
  }

  public override getScopes() {
    return Object.freeze(this.#def.scopes || []);
  }

  public override getTags() {
    return Object.freeze(this.#def.tags || []);
  }

  public override getOperationId(method: Method): string | undefined {
    return this.#def.getOperationId?.(method);
  }

  async #parseOutput(output: z.input<OUT>) {
    try {
      return (await this.#def.outputSchema.parseAsync(output)) as FlatObject;
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
    for (const mw of this.#def.middlewares || []) {
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
      finalInput = (await this.#def.inputSchema.parseAsync(
        input,
      )) as z.output<IN>;
    } catch (e) {
      throw e instanceof z.ZodError ? new InputValidationError(e) : e;
    }
    return this.#def.handler({ ...rest, input: finalInput });
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
      await this.#def.resultHandler.execute({ ...rest, error });
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
