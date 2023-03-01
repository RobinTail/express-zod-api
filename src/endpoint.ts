import { Request, Response } from "express";
import { Logger } from "winston";
import { z } from "zod";
import { ApiResponse } from "./api-response";
import { CommonConfig } from "./config-type";
import {
  IOSchemaError,
  OutputValidationError,
  ResultHandlerError,
} from "./errors";
import {
  FlatObject,
  getActualMethod,
  getInput,
  getMessageFromError,
  hasTopLevelTransformingEffect,
  makeErrorFromAnything,
} from "./common-helpers";
import { IOSchema } from "./io-schema";
import { LogicalContainer, combineContainers } from "./logical-container";
import { AuxMethod, Method, MethodsDefinition } from "./method";
import { AnyMiddlewareDef } from "./middleware";
import { mimeJson } from "./mime";
import { ResultHandlerDefinition, lastResortHandler } from "./result-handler";
import { Security } from "./security";

export type Handler<IN, OUT, OPT> = (params: {
  input: IN;
  options: OPT;
  logger: Logger;
}) => Promise<OUT>;

export abstract class AbstractEndpoint {
  public abstract execute(params: {
    request: Request;
    response: Response;
    logger: Logger;
    config: CommonConfig;
  }): Promise<void>;
  public abstract getDescription(variant: "short" | "long"): string | undefined;
  public abstract getMethods(): Method[];
  public abstract getInputSchema(): IOSchema;
  public abstract getOutputSchema(): IOSchema;
  public abstract getPositiveResponseSchema(): z.ZodTypeAny;
  public abstract getNegativeResponseSchema(): z.ZodTypeAny;
  public abstract getInputMimeTypes(): string[];
  public abstract getPositiveMimeTypes(): string[];
  public abstract getNegativeMimeTypes(): string[];
  public abstract getPositiveStatusCode(): number;
  public abstract getNegativeStatusCode(): number;
  public abstract getSecurity(): LogicalContainer<Security>;
  public abstract getScopes(): string[];
  public abstract getTags(): string[];
  public abstract _setSiblingMethods(methods: Method[]): void;
}

type EndpointProps<
  IN extends IOSchema,
  OUT extends IOSchema,
  OPT extends FlatObject,
  M extends Method,
  POS extends z.ZodType,
  NEG extends z.ZodType,
  SCO extends string,
  TAG extends string
> = {
  middlewares: AnyMiddlewareDef[];
  inputSchema: IN;
  mimeTypes: string[];
  outputSchema: OUT;
  handler: Handler<z.output<IN>, z.input<OUT>, OPT>;
  resultHandler: ResultHandlerDefinition<POS, NEG>;
  description?: string;
  shortDescription?: string;
} & ({ scopes?: SCO[] } | { scope?: SCO }) &
  ({ tags?: TAG[] } | { tag?: TAG }) &
  MethodsDefinition<M>;

export class Endpoint<
  IN extends IOSchema,
  OUT extends IOSchema,
  OPT extends FlatObject,
  M extends Method,
  POS extends z.ZodType,
  NEG extends z.ZodType,
  SCO extends string,
  TAG extends string
> extends AbstractEndpoint {
  protected readonly descriptions: Record<"short" | "long", string | undefined>;
  protected readonly methods: M[] = [];
  protected siblingMethods: Method[] = [];
  protected readonly middlewares: AnyMiddlewareDef[] = [];
  protected readonly inputSchema: IN;
  protected readonly mimeTypes: string[];
  protected readonly outputSchema: OUT;
  protected readonly handler: Handler<z.output<IN>, z.input<OUT>, OPT>;
  protected readonly resultHandler: ResultHandlerDefinition<POS, NEG>;
  protected readonly scopes: SCO[];
  protected readonly tags: TAG[];

  constructor({
    middlewares,
    inputSchema,
    outputSchema,
    handler,
    resultHandler,
    description,
    shortDescription,
    mimeTypes,
    ...rest
  }: EndpointProps<IN, OUT, OPT, M, POS, NEG, SCO, TAG>) {
    super();
    [
      { name: "input schema", schema: inputSchema },
      { name: "output schema", schema: outputSchema },
    ].forEach(({ name, schema }) => {
      if (hasTopLevelTransformingEffect(schema)) {
        throw new IOSchemaError(
          `Using transformations on the top level of endpoint ${name} is not allowed.`
        );
      }
    });
    this.middlewares = middlewares;
    this.inputSchema = inputSchema;
    this.mimeTypes = mimeTypes;
    this.outputSchema = outputSchema;
    this.handler = handler;
    this.resultHandler = resultHandler;
    this.descriptions = { long: description, short: shortDescription };
    this.scopes = [];
    this.tags = [];
    if ("scopes" in rest && rest.scopes) {
      this.scopes.push(...rest.scopes);
    }
    if ("scope" in rest && rest.scope) {
      this.scopes.push(rest.scope);
    }
    if ("tags" in rest && rest.tags) {
      this.tags.push(...rest.tags);
    }
    if ("tag" in rest && rest.tag) {
      this.tags.push(rest.tag);
    }
    if ("methods" in rest) {
      this.methods = rest.methods;
    } else {
      this.methods = [rest.method];
    }
  }

  /**
   * @desc Sets the other methods supported by the same path. Used by Routing in DependsOnMethod case, for options.
   * @deprecated This method is for internal needs of the library, please avoid using it.
   * */
  public override _setSiblingMethods(methods: Method[]): void {
    this.siblingMethods = methods;
  }

  public override getDescription(variant: "short" | "long") {
    return this.descriptions[variant];
  }

  public override getMethods(): M[] {
    return this.methods;
  }

  public override getInputSchema(): IN {
    return this.inputSchema;
  }

  public override getOutputSchema(): OUT {
    return this.outputSchema;
  }

  public override getPositiveResponseSchema(): POS {
    const apiResponse = this.resultHandler.getPositiveResponse(
      this.outputSchema
    );
    return apiResponse instanceof z.ZodType ? apiResponse : apiResponse.schema;
  }

  public override getNegativeResponseSchema(): NEG {
    const apiResponse = this.resultHandler.getNegativeResponse();
    return apiResponse instanceof z.ZodType ? apiResponse : apiResponse.schema;
  }

  public override getInputMimeTypes() {
    return this.mimeTypes;
  }

  #getMimeTypesFromApiResponse<S extends z.ZodType>(
    subject: S | ApiResponse<S>,
    fallback = [mimeJson]
  ) {
    return subject instanceof z.ZodType
      ? fallback
      : "mimeType" in subject && subject.mimeType
      ? [subject.mimeType]
      : "mimeTypes" in subject && subject.mimeTypes
      ? subject.mimeTypes
      : fallback;
  }

  public override getPositiveMimeTypes() {
    return this.#getMimeTypesFromApiResponse(
      this.resultHandler.getPositiveResponse(this.outputSchema)
    );
  }

  public override getNegativeMimeTypes() {
    return this.#getMimeTypesFromApiResponse(
      this.resultHandler.getNegativeResponse()
    );
  }

  public override getPositiveStatusCode() {
    const apiResponse = this.resultHandler.getPositiveResponse(
      this.outputSchema
    );
    return apiResponse instanceof z.ZodType
      ? 200
      : apiResponse.statusCode || 200;
  }

  public override getNegativeStatusCode() {
    const apiResponse = this.resultHandler.getNegativeResponse();
    return apiResponse instanceof z.ZodType
      ? 400
      : apiResponse.statusCode || 400;
  }

  public override getSecurity() {
    return this.middlewares.reduce<LogicalContainer<Security>>(
      (acc, middleware) =>
        middleware.security ? combineContainers(acc, middleware.security) : acc,
      { and: [] }
    );
  }

  public override getScopes(): SCO[] {
    return this.scopes;
  }

  public override getTags(): TAG[] {
    return this.tags;
  }

  #getDefaultCorsHeaders(): Record<string, string> {
    const accessMethods = (this.methods as Array<Method | AuxMethod>)
      .concat(this.siblingMethods)
      .concat("options")
      .join(", ")
      .toUpperCase();
    return {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": accessMethods,
      "Access-Control-Allow-Headers": "content-type",
    };
  }

  async #parseOutput(output: any) {
    try {
      return await this.outputSchema.parseAsync(output);
    } catch (e) {
      const error =
        e instanceof z.ZodError
          ? new z.ZodError(
              e.issues.map(({ path, ...rest }) => ({
                ...rest,
                path: (["output"] as typeof path).concat(path),
              }))
            )
          : makeErrorFromAnything(e);
      throw new OutputValidationError(getMessageFromError(error));
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
    input: Readonly<any>; // Issue #673: input is immutable, since this.inputSchema is combined with ones of middlewares
    request: Request;
    response: Response;
    logger: Logger;
  }) {
    const options: any = {};
    let isStreamClosed = false;
    for (const def of this.middlewares) {
      if (method === "options" && def.type === "proprietary") {
        continue;
      }
      Object.assign(
        options,
        await def.middleware({
          input: await def.input.parseAsync(input),
          options,
          request,
          response,
          logger,
        })
      );
      isStreamClosed = "writableEnded" in response && response.writableEnded;
      if (isStreamClosed) {
        logger.warn(
          `The middleware ${def.middleware.name} has closed the stream. Accumulated options:`,
          options
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
    input: Readonly<any>;
    options: any;
    logger: Logger;
  }) {
    return this.handler({
      // final input types transformations for handler
      input: (await this.inputSchema.parseAsync(input)) as z.output<IN>,
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
    logger: Logger;
    input: any;
    output: any;
  }) {
    try {
      await this.resultHandler.handler({
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
  }: {
    request: Request;
    response: Response;
    logger: Logger;
    config: CommonConfig;
  }) {
    const method = getActualMethod(request);
    let output: any;
    let error: Error | null = null;
    if (config.cors) {
      let headers = this.#getDefaultCorsHeaders();
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
        await this.#parseAndRunHandler({ input, options, logger })
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
