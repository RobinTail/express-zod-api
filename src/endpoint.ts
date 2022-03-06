import { Request, Response } from "express";
import { Logger } from "winston";
import { z } from "zod";
import { ApiResponse } from "./api-response";
import { CommonConfig } from "./config-type";
import { ResultHandlerError } from "./errors";
import {
  FlatObject,
  getInitialInput,
  IOSchema,
  OutputMarker,
  ReplaceMarkerInShape,
} from "./common-helpers";
import { Method, MethodsDefinition } from "./method";
import { AnyMiddlewareDef } from "./middleware";
import { lastResortHandler, ResultHandlerDefinition } from "./result-handler";

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
  public abstract getDescription(): string | undefined;
  public abstract getMethods(): Method[];
  public abstract getInputSchema(): IOSchema;
  public abstract getOutputSchema(): IOSchema;
  public abstract getPositiveResponseSchema(): z.ZodTypeAny;
  public abstract getNegativeResponseSchema(): z.ZodTypeAny;
  public abstract getInputMimeTypes(): string[];
  public abstract getPositiveMimeTypes(): string[];
  public abstract getNegativeMimeTypes(): string[];
}

export type EndpointInput<T> = T extends Endpoint<
  infer IN,
  any,
  any,
  any,
  any,
  any
>
  ? z.input<IN>
  : never;

export type EndpointOutput<T> = T extends Endpoint<
  any,
  infer OUT,
  any,
  any,
  any,
  any
>
  ? z.output<OUT>
  : never;

export type EndpointResponse<E extends AbstractEndpoint> =
  | z.output<
      ReturnType<
        E["getPositiveResponseSchema"]
      > extends z.ZodObject<z.ZodRawShape> // in object response
        ? z.ZodObject<
            ReplaceMarkerInShape<
              ReturnType<E["getPositiveResponseSchema"]>["_shape"],
              ReturnType<E["getOutputSchema"]>
            >
          >
        : ReturnType<E["getPositiveResponseSchema"]> extends OutputMarker // "as is" response
        ? ReturnType<E["getOutputSchema"]>
        : ReturnType<E["getPositiveResponseSchema"]> // explicitly defined response
    >
  | z.output<ReturnType<E["getNegativeResponseSchema"]>>;

type EndpointProps<
  IN extends IOSchema,
  OUT extends IOSchema,
  OPT extends FlatObject,
  M extends Method,
  POS extends ApiResponse,
  NEG extends ApiResponse
> = {
  middlewares: AnyMiddlewareDef[];
  inputSchema: IN;
  mimeTypes: string[];
  outputSchema: OUT;
  handler: Handler<z.output<IN>, z.input<OUT>, OPT>;
  resultHandler: ResultHandlerDefinition<POS, NEG>;
  description?: string;
} & MethodsDefinition<M>;

export class Endpoint<
  IN extends IOSchema,
  OUT extends IOSchema,
  OPT extends FlatObject,
  M extends Method,
  POS extends ApiResponse,
  NEG extends ApiResponse
> extends AbstractEndpoint {
  protected readonly description?: string;
  protected readonly methods: M[] = [];
  protected readonly middlewares: AnyMiddlewareDef[] = [];
  protected readonly inputSchema: IN;
  protected readonly mimeTypes: string[];
  protected readonly outputSchema: OUT;
  protected readonly handler: Handler<z.output<IN>, z.input<OUT>, OPT>;
  protected readonly resultHandler: ResultHandlerDefinition<POS, NEG>;

  constructor({
    middlewares,
    inputSchema,
    outputSchema,
    handler,
    resultHandler,
    description,
    mimeTypes,
    ...rest
  }: EndpointProps<IN, OUT, OPT, M, POS, NEG>) {
    super();
    this.middlewares = middlewares;
    this.inputSchema = inputSchema;
    this.mimeTypes = mimeTypes;
    this.outputSchema = outputSchema;
    this.handler = handler;
    this.resultHandler = resultHandler;
    this.description = description;
    if ("methods" in rest) {
      this.methods = rest.methods;
    } else {
      this.methods = [rest.method];
    }
  }

  public override getDescription() {
    return this.description;
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

  public override getPositiveResponseSchema(): POS["schema"] {
    return this.resultHandler.getPositiveResponse(this.outputSchema).schema;
  }

  public override getNegativeResponseSchema(): NEG["schema"] {
    return this.resultHandler.getNegativeResponse().schema;
  }

  public override getInputMimeTypes() {
    return this.mimeTypes;
  }

  public override getPositiveMimeTypes() {
    return this.resultHandler.getPositiveResponse(this.outputSchema).mimeTypes;
  }

  public override getNegativeMimeTypes() {
    return this.resultHandler.getNegativeResponse().mimeTypes;
  }

  #setupCorsHeaders(response: Response) {
    const accessMethods = this.methods
      .map((method) => method.toUpperCase())
      .concat("OPTIONS")
      .join(", ");
    response.set("Access-Control-Allow-Origin", "*");
    response.set("Access-Control-Allow-Methods", accessMethods);
    response.set("Access-Control-Allow-Headers", "content-type");
  }

  async #parseOutput(output: any) {
    try {
      return await this.outputSchema.parseAsync(output);
    } catch (e) {
      if (e instanceof z.ZodError) {
        throw new z.ZodError([
          {
            message: "Invalid format",
            code: "custom",
            path: ["output"],
          },
          ...e.issues.map((issue) => ({
            ...issue,
            path: issue.path.length === 0 ? ["output"] : issue.path,
          })),
        ]);
      }
      throw e;
    }
  }

  async #runMiddlewares({
    input,
    request,
    response,
    logger,
  }: {
    input: any;
    request: Request;
    response: Response;
    logger: Logger;
  }) {
    const options: any = {};
    let isStreamClosed = false;
    for (const def of this.middlewares) {
      Object.assign(input, await def.input.parseAsync(input)); // middleware can transform the input types
      Object.assign(
        options,
        await def.middleware({
          input,
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
    return { input, options, isStreamClosed };
  }

  async #parseAndRunHandler({
    input,
    options,
    logger,
  }: {
    input: any;
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
    initialInput,
    output,
  }: {
    error: Error | null;
    request: Request;
    response: Response;
    logger: Logger;
    initialInput: any;
    output: any;
  }) {
    try {
      await this.resultHandler.handler({
        error,
        output,
        request,
        response,
        logger,
        input: initialInput,
      });
    } catch (e) {
      if (e instanceof Error) {
        lastResortHandler({
          logger,
          response,
          error: new ResultHandlerError(e.message, error),
        });
      }
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
    let output: any;
    let error: Error | null = null;
    if (config.cors) {
      this.#setupCorsHeaders(response);
    }
    if (request.method === "OPTIONS") {
      response.end();
      return;
    }
    const initialInput = getInitialInput(request, config.inputSources);
    try {
      const { input, options, isStreamClosed } = await this.#runMiddlewares({
        input: { ...initialInput }, // preserve the initial
        request,
        response,
        logger,
      });
      if (isStreamClosed) {
        return;
      }
      output = await this.#parseOutput(
        await this.#parseAndRunHandler({ input, options, logger })
      );
    } catch (e) {
      if (e instanceof Error) {
        error = e;
      }
    }
    await this.#handleResult({
      initialInput,
      output,
      request,
      response,
      error,
      logger,
    });
  }
}
