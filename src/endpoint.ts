import { Request, Response } from "express";
import assert from "node:assert/strict";
import { z } from "zod";
import {
  NormalizedResponse,
  defaultStatusCodes,
  normalizeApiResponse,
} from "./api-response";
import { hasRaw, hasTransformationOnTop, hasUpload } from "./deep-checks";
import {
  FlatObject,
  getActualMethod,
  getInput,
  makeErrorFromAnything,
} from "./common-helpers";
import { CommonConfig } from "./config-type";
import {
  IOSchemaError,
  InputValidationError,
  OutputValidationError,
  ResultHandlerError,
} from "./errors";
import { IOSchema } from "./io-schema";
import { lastResortHandler } from "./last-resort";
import { AbstractLogger } from "./logger";
import { LogicalContainer, combineContainers } from "./logical-container";
import { AuxMethod, Method } from "./method";
import { AnyMiddlewareDef } from "./middleware";
import { mimeJson, mimeMultipart, mimeRaw } from "./mime";
import { AnyResultHandlerDefinition } from "./result-handler";
import { Security } from "./security";

export type Handler<IN, OUT, OPT> = (params: {
  input: IN;
  options: OPT;
  logger: AbstractLogger;
}) => Promise<OUT>;

type DescriptionVariant = "short" | "long";
type IOVariant = "input" | "output";
type ResponseVariant = "positive" | "negative";
type MimeVariant = Extract<IOVariant, "input"> | ResponseVariant;

export abstract class AbstractEndpoint {
  public abstract execute(params: {
    request: Request;
    response: Response;
    logger: AbstractLogger;
    config: CommonConfig;
    siblingMethods?: Method[];
  }): Promise<void>;
  public abstract getDescription(
    variant: DescriptionVariant,
  ): string | undefined;
  public abstract getMethods(): Method[];
  public abstract getSchema(variant: IOVariant): IOSchema;
  public abstract getSchema(variant: ResponseVariant): z.ZodTypeAny;
  public abstract getMimeTypes(variant: MimeVariant): string[];
  public abstract getResponses(variant: ResponseVariant): NormalizedResponse[];
  public abstract getSecurity(): LogicalContainer<Security>;
  public abstract getScopes(): string[];
  public abstract getTags(): string[];
  public abstract getOperationId(method: Method): string | undefined;
}

export class Endpoint<
  IN extends IOSchema,
  OUT extends IOSchema,
  OPT extends FlatObject,
  SCO extends string,
  TAG extends string,
> extends AbstractEndpoint {
  readonly #descriptions: Record<DescriptionVariant, string | undefined>;
  readonly #methods: Method[];
  readonly #middlewares: AnyMiddlewareDef[];
  readonly #mimeTypes: Record<MimeVariant, string[]>;
  readonly #responses: Record<ResponseVariant, NormalizedResponse[]>;
  readonly #handler: Handler<z.output<IN>, z.input<OUT>, OPT>;
  readonly #resultHandler: AnyResultHandlerDefinition;
  readonly #schemas: { input: IN; output: OUT };
  readonly #scopes: SCO[];
  readonly #tags: TAG[];
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
    middlewares?: AnyMiddlewareDef[];
    inputSchema: IN;
    outputSchema: OUT;
    handler: Handler<z.output<IN>, z.input<OUT>, OPT>;
    resultHandler: AnyResultHandlerDefinition;
    description?: string;
    shortDescription?: string;
    getOperationId?: (method: Method) => string | undefined;
    methods: Method[];
    scopes?: SCO[];
    tags?: TAG[];
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
    for (const [variant, schema] of Object.entries(this.#schemas)) {
      assert(
        !hasTransformationOnTop(schema),
        new IOSchemaError(
          `Using transformations on the top level of endpoint ${variant} schema is not allowed.`,
        ),
      );
    }
    this.#responses = {
      positive: normalizeApiResponse(
        resultHandler.getPositiveResponse(outputSchema),
        { mimeTypes: [mimeJson], statusCodes: [defaultStatusCodes.positive] },
      ),
      negative: normalizeApiResponse(resultHandler.getNegativeResponse(), {
        mimeTypes: [mimeJson],
        statusCodes: [defaultStatusCodes.negative],
      }),
    };
    for (const [variant, responses] of Object.entries(this.#responses)) {
      assert(
        responses.length,
        new ResultHandlerError(
          `ResultHandler must have at least one ${variant} response schema specified.`,
        ),
      );
    }
    this.#mimeTypes = {
      input: hasUpload(inputSchema)
        ? [mimeMultipart]
        : hasRaw(inputSchema)
          ? [mimeRaw]
          : [mimeJson],
      positive: this.#responses.positive.flatMap(({ mimeTypes }) => mimeTypes),
      negative: this.#responses.negative.flatMap(({ mimeTypes }) => mimeTypes),
    };
  }

  public override getDescription(variant: DescriptionVariant) {
    return this.#descriptions[variant];
  }

  public override getMethods(): Method[] {
    return this.#methods;
  }

  public override getSchema(variant: "input"): IN;
  public override getSchema(variant: "output"): OUT;
  public override getSchema(variant: ResponseVariant): z.ZodTypeAny;
  public override getSchema(variant: IOVariant | ResponseVariant) {
    if (variant === "input" || variant === "output") {
      return this.#schemas[variant];
    }
    return this.getResponses(variant)
      .map(({ schema }) => schema)
      .reduce((agg, schema) => agg.or(schema));
  }

  public override getMimeTypes(variant: MimeVariant) {
    return this.#mimeTypes[variant];
  }

  public override getResponses(variant: ResponseVariant) {
    return this.#responses[variant];
  }

  public override getSecurity() {
    return this.#middlewares.reduce<LogicalContainer<Security>>(
      (acc, middleware) =>
        middleware.security ? combineContainers(acc, middleware.security) : acc,
      { and: [] },
    );
  }

  public override getScopes(): SCO[] {
    return this.#scopes;
  }

  public override getTags(): TAG[] {
    return this.#tags;
  }

  public override getOperationId(method: Method): string | undefined {
    return this.#getOperationId(method);
  }

  #getDefaultCorsHeaders(siblingMethods: Method[]): Record<string, string> {
    const accessMethods = (this.#methods as Array<Method | AuxMethod>)
      .concat(siblingMethods)
      .concat("options")
      .join(", ")
      .toUpperCase();
    return {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": accessMethods,
      "Access-Control-Allow-Headers": "content-type",
    };
  }

  async #parseOutput(output: z.input<OUT>) {
    try {
      return (await this.#schemas.output.parseAsync(output)) as FlatObject;
    } catch (e) {
      if (e instanceof z.ZodError) {
        throw new OutputValidationError(e);
      }
      throw e;
    }
  }

  async #runMiddlewares({
    method,
    input,
    request,
    response,
    logger,
  }: {
    method: Method | AuxMethod;
    input: Readonly<FlatObject>; // Issue #673: input is immutable, since this.inputSchema is combined with ones of middlewares
    request: Request;
    response: Response;
    logger: AbstractLogger;
  }) {
    const options = {} as OPT;
    let isStreamClosed = false;
    for (const def of this.#middlewares) {
      if (method === "options" && def.type === "proprietary") {
        continue;
      }
      let finalInput: unknown;
      try {
        finalInput = await def.input.parseAsync(input);
      } catch (e) {
        if (e instanceof z.ZodError) {
          throw new InputValidationError(e);
        }
        throw e;
      }
      Object.assign(
        options,
        await def.middleware({
          input: finalInput,
          options,
          request,
          response,
          logger,
        }),
      );
      isStreamClosed = response.writableEnded;
      if (isStreamClosed) {
        logger.warn(
          `The middleware ${def.middleware.name} has closed the stream. Accumulated options:`,
          options,
        );
        break;
      }
    }
    return { options, isStreamClosed };
  }

  async #parseAndRunHandler({
    input,
    options,
    logger,
  }: {
    input: Readonly<FlatObject>;
    options: OPT;
    logger: AbstractLogger;
  }) {
    let finalInput: z.output<IN>; // final input types transformations for handler
    try {
      finalInput = (await this.#schemas.input.parseAsync(
        input,
      )) as z.output<IN>;
    } catch (e) {
      if (e instanceof z.ZodError) {
        throw new InputValidationError(e);
      }
      throw e;
    }
    return this.#handler({
      input: finalInput,
      options,
      logger,
    });
  }

  async #handleResult({
    error,
    request,
    response,
    logger,
    input,
    output,
  }: {
    error: Error | null;
    request: Request;
    response: Response;
    logger: AbstractLogger;
    input: FlatObject;
    output: FlatObject | null;
  }) {
    try {
      await this.#resultHandler.handler({
        error,
        output,
        request,
        response,
        logger,
        input,
      });
    } catch (e) {
      lastResortHandler({
        logger,
        response,
        error: new ResultHandlerError(makeErrorFromAnything(e).message, error),
      });
    }
  }

  public override async execute({
    request,
    response,
    logger,
    config,
    siblingMethods = [],
  }: {
    request: Request;
    response: Response;
    logger: AbstractLogger;
    config: CommonConfig;
    siblingMethods?: Method[];
  }) {
    const method = getActualMethod(request);
    let output: FlatObject | null = null;
    let error: Error | null = null;
    if (config.cors) {
      let headers = this.#getDefaultCorsHeaders(siblingMethods);
      if (typeof config.cors === "function") {
        headers = await config.cors({
          request,
          logger,
          endpoint: this,
          defaultHeaders: headers,
        });
      }
      for (const key in headers) {
        response.set(key, headers[key]);
      }
    }
    const input = getInput(request, config.inputSources);
    try {
      const { options, isStreamClosed } = await this.#runMiddlewares({
        method,
        input,
        request,
        response,
        logger,
      });
      if (isStreamClosed) {
        return;
      }
      if (method === "options") {
        response.status(200).end();
        return;
      }
      output = await this.#parseOutput(
        await this.#parseAndRunHandler({ input, options, logger }),
      );
    } catch (e) {
      error = makeErrorFromAnything(e);
    }
    await this.#handleResult({
      input,
      output,
      request,
      response,
      error,
      logger,
    });
  }
}
