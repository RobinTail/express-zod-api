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
import { LogicalContainer, combineContainers } from "./logical-container";
import { AuxMethod, Method } from "./method";
import { AbstractMiddleware, ExpressMiddleware } from "./middleware";
import { ContentType, contentTypes } from "./content-type";
import { AbstractResultHandler } from "./result-handler";
import { Security } from "./security";

export type Handler<IN, OUT, OPT> = (params: {
  input: IN;
  options: OPT;
  logger: ActualLogger;
}) => Promise<OUT>;

type DescriptionVariant = "short" | "long";
type IOVariant = "input" | "output";
type MimeVariant = Extract<IOVariant, "input"> | ResponseVariant;

export abstract class AbstractEndpoint {
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
  public abstract getSchema(variant: ResponseVariant): z.ZodTypeAny;
  public abstract getMimeTypes(variant: MimeVariant): ReadonlyArray<string>;
  public abstract getResponses(
    variant: ResponseVariant,
  ): ReadonlyArray<NormalizedResponse>;
  public abstract getSecurity(): LogicalContainer<Security>;
  public abstract getScopes(): ReadonlyArray<string>;
  public abstract getTags(): ReadonlyArray<string>;
  public abstract getOperationId(method: Method): string | undefined;
  public abstract getRequestType(): ContentType;
}

export class Endpoint<
  IN extends IOSchema,
  OUT extends IOSchema,
  OPT extends FlatObject,
  SCO extends string,
  TAG extends string,
> extends AbstractEndpoint {
  readonly #descriptions: Record<DescriptionVariant, string | undefined>;
  readonly #methods?: ReadonlyArray<Method>;
  readonly #middlewares: AbstractMiddleware[];
  readonly #mimeTypes: Record<MimeVariant, ReadonlyArray<string>>;
  readonly #responses: Record<
    ResponseVariant,
    ReadonlyArray<NormalizedResponse>
  >;
  readonly #handler: Handler<z.output<IN>, z.input<OUT>, OPT>;
  readonly #resultHandler: AbstractResultHandler;
  readonly #schemas: { input: IN; output: OUT };
  readonly #scopes: ReadonlyArray<SCO>;
  readonly #tags: ReadonlyArray<TAG>;
  readonly #getOperationId: (method: Method) => string | undefined;
  readonly #requestType: ContentType;

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
    scopes?: SCO[];
    tags?: TAG[];
  }) {
    super();
    this.#handler = handler;
    this.#resultHandler = resultHandler;
    this.#middlewares = middlewares;
    this.#getOperationId = getOperationId;
    this.#methods = Object.freeze(methods);
    this.#scopes = Object.freeze(scopes);
    this.#tags = Object.freeze(tags);
    this.#descriptions = { long, short };
    this.#schemas = { input: inputSchema, output: outputSchema };
    this.#responses = {
      positive: Object.freeze(resultHandler.getPositiveResponse(outputSchema)),
      negative: Object.freeze(resultHandler.getNegativeResponse()),
    };
    this.#requestType = hasUpload(inputSchema)
      ? "upload"
      : hasRaw(inputSchema)
        ? "raw"
        : "json";
    this.#mimeTypes = {
      input: Object.freeze([contentTypes[this.#requestType]]),
      positive: Object.freeze(
        this.#responses.positive.flatMap(({ mimeTypes }) => mimeTypes),
      ),
      negative: Object.freeze(
        this.#responses.negative.flatMap(({ mimeTypes }) => mimeTypes),
      ),
    };
  }

  public override getDescription(variant: DescriptionVariant) {
    return this.#descriptions[variant];
  }

  public override getMethods() {
    return this.#methods;
  }

  public override getSchema(variant: "input"): IN;
  public override getSchema(variant: "output"): OUT;
  public override getSchema(variant: ResponseVariant): z.ZodTypeAny;
  public override getSchema(variant: IOVariant | ResponseVariant) {
    if (variant === "input" || variant === "output")
      return this.#schemas[variant];
    return this.getResponses(variant)
      .map(({ schema }) => schema)
      .reduce((agg, schema) => agg.or(schema));
  }

  public override getMimeTypes(variant: MimeVariant) {
    return this.#mimeTypes[variant];
  }

  public override getRequestType() {
    return this.#requestType;
  }

  public override getResponses(variant: ResponseVariant) {
    return this.#responses[variant];
  }

  public override getSecurity() {
    return this.#middlewares.reduce<LogicalContainer<Security>>(
      (acc, middleware) => {
        const security = middleware.getSecurity();
        return security ? combineContainers(acc, security) : acc;
      },
      { and: [] },
    );
  }

  public override getScopes() {
    return this.#scopes;
  }

  public override getTags() {
    return this.#tags;
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
