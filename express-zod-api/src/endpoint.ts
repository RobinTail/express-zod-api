import { Request, Response } from "express";
import * as R from "ramda";
import { z, globalRegistry } from "zod";
import { NormalizedResponse, ResponseVariant } from "./api-response";
import { findRequestTypeDefiningSchema } from "./deep-checks";
import {
  FlatObject,
  getActualMethod,
  getInput,
  ensureError,
  isSchema,
} from "./common-helpers";
import { CommonConfig } from "./config-type";
import {
  InputValidationError,
  OutputValidationError,
  ResultHandlerError,
} from "./errors";
import { ezFormBrand } from "./form-schema";
import { IOSchema } from "./io-schema";
import { lastResortHandler } from "./last-resort";
import { ActualLogger } from "./logger-helpers";
import { LogicalContainer } from "./logical-container";
import { getBrand } from "@express-zod-api/zod-plugin";
import { ClientMethod, CORSMethod, Method, SomeMethod } from "./method";
import { AbstractMiddleware, ExpressMiddleware } from "./middleware";
import { ContentType } from "./content-type";
import { ezRawBrand } from "./raw-schema";
import { DiscriminatedResult, pullResponseExamples } from "./result-helpers";
import { AbstractResultHandler } from "./result-handler";
import type { Routing } from "./routing";
import { Security } from "./security";
import { ezUploadBrand } from "./upload-schema";

export type Handler<IN, OUT, CTX> = (params: {
  /** @desc The inputs from the enabled input sources validated against the final input schema (incl. Middlewares) */
  input: IN;
  /** @desc The returns of the assigned Middlewares */
  ctx: CTX;
  /** @desc The instance of the configured logger */
  logger: ActualLogger;
}) => Promise<OUT>;

export abstract class AbstractEndpoint {
  /** @desc Enables nested routes within the path assigned to the subject */
  public nest(routing: Routing): Routing {
    return { ...routing, "": this };
  }
  /** @desc Marks the route as deprecated (makes a copy of the endpoint) */
  public abstract deprecated(): this;
  public abstract execute(params: {
    request: Request;
    response: Response;
    logger: ActualLogger;
    config: CommonConfig;
  }): Promise<void>;
  /** @internal */
  public abstract getResponses(
    variant: ResponseVariant,
  ): ReadonlyArray<NormalizedResponse>;
  /** @internal */
  public abstract getOperationId(method: ClientMethod): string | undefined;
  /** @internal */
  public abstract get description(): string | undefined;
  /** @internal */
  public abstract get shortDescription(): string | undefined;
  /** @internal */
  public abstract get methods(): ReadonlyArray<Method> | undefined;
  /** @internal */
  public abstract get inputSchema(): IOSchema;
  /** @internal */
  public abstract get outputSchema(): IOSchema;
  /** @internal */
  public abstract get security(): LogicalContainer<Security>[];
  /** @internal */
  public abstract get scopes(): ReadonlyArray<string>;
  /** @internal */
  public abstract get tags(): ReadonlyArray<string>;
  /** @internal */
  public abstract get requestType(): ContentType;
  /** @internal */
  public abstract get isDeprecated(): boolean;
}

export class Endpoint<
  IN extends IOSchema,
  OUT extends IOSchema,
  CTX extends FlatObject,
> extends AbstractEndpoint {
  readonly #def: ConstructorParameters<typeof Endpoint<IN, OUT, CTX>>[0];

  /** considered expensive operation, only required for generators */
  #ensureOutputExamples = R.once(() => {
    if (globalRegistry.get(this.#def.outputSchema)?.examples?.length) return; // examples on output schema, or pull up:
    if (!isSchema<z.core.$ZodObject>(this.#def.outputSchema, "object")) return;
    const examples = pullResponseExamples(this.#def.outputSchema);
    if (!examples.length) return;
    const current = this.#def.outputSchema.meta();
    globalRegistry
      .remove(this.#def.outputSchema) // reassign to avoid cloning
      .add(this.#def.outputSchema, { ...current, examples });
  });

  constructor(def: {
    deprecated?: boolean;
    middlewares?: AbstractMiddleware[];
    inputSchema: IN;
    outputSchema: OUT;
    handler: Handler<z.output<IN>, z.input<OUT>, CTX>;
    resultHandler: AbstractResultHandler;
    description?: string;
    shortDescription?: string;
    getOperationId?: (method: ClientMethod) => string | undefined;
    methods?: Method[];
    scopes?: string[];
    tags?: string[];
  }) {
    super();
    this.#def = def;
  }

  #clone(
    inc?: Partial<ConstructorParameters<typeof Endpoint<IN, OUT, CTX>>[0]>,
  ) {
    return new Endpoint({ ...this.#def, ...inc });
  }

  public override deprecated() {
    return this.#clone({ deprecated: true }) as this;
  }

  /** @internal */
  public override get isDeprecated(): boolean {
    return this.#def.deprecated || false;
  }

  /** @internal */
  public override get description() {
    return this.#def.description;
  }

  /** @internal */
  public override get shortDescription() {
    return this.#def.shortDescription;
  }

  /** @internal */
  public override get methods() {
    return Object.freeze(this.#def.methods);
  }

  /** @internal */
  public override get inputSchema(): IN {
    return this.#def.inputSchema;
  }

  /** @internal */
  public override get outputSchema(): OUT {
    this.#ensureOutputExamples();
    return this.#def.outputSchema;
  }

  /** @internal */
  public override get requestType() {
    const found = findRequestTypeDefiningSchema(this.#def.inputSchema);
    if (found) {
      const brand = getBrand(found);
      if (brand === ezUploadBrand) return "upload";
      if (brand === ezRawBrand) return "raw";
      if (brand === ezFormBrand) return "form";
    }
    return "json";
  }

  /** @internal */
  public override getResponses(variant: ResponseVariant) {
    if (variant === "positive") this.#ensureOutputExamples();
    return Object.freeze(
      variant === "negative"
        ? this.#def.resultHandler.getNegativeResponse()
        : this.#def.resultHandler.getPositiveResponse(this.#def.outputSchema),
    );
  }

  /** @internal */
  public override get security() {
    const entries = R.pluck("security", this.#def.middlewares || []);
    return R.reject(R.isNil, entries);
  }

  /** @internal */
  public override get scopes() {
    return Object.freeze(this.#def.scopes || []);
  }

  /** @internal */
  public override get tags() {
    return Object.freeze(this.#def.tags || []);
  }

  /** @internal */
  public override getOperationId(method: ClientMethod): string | undefined {
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
    ctx,
    response,
    ...rest
  }: {
    method: SomeMethod;
    input: Readonly<FlatObject>; // Issue #673: input is immutable, since this.inputSchema is combined with ones of middlewares
    request: Request;
    response: Response;
    logger: ActualLogger;
    ctx: Partial<CTX>;
  }) {
    for (const mw of this.#def.middlewares || []) {
      if (
        method === ("options" satisfies CORSMethod) &&
        !(mw instanceof ExpressMiddleware)
      )
        continue;
      Object.assign(ctx, await mw.execute({ ...rest, ctx, response, logger }));
      if (response.writableEnded) {
        logger.warn(
          "A middleware has closed the stream. Accumulated context:",
          ctx,
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
    ctx: CTX;
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

  async #handleResult(
    params: DiscriminatedResult & {
      request: Request;
      response: Response;
      logger: ActualLogger;
      input: FlatObject;
      ctx: Partial<CTX>;
    },
  ) {
    try {
      await this.#def.resultHandler.execute(params);
    } catch (e) {
      lastResortHandler({
        ...params,
        error: new ResultHandlerError(
          ensureError(e),
          params.error || undefined,
        ),
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
    const ctx: Partial<CTX> = {};
    let result: DiscriminatedResult = { output: {}, error: null };
    const input = getInput(request, config.inputSources);
    try {
      await this.#runMiddlewares({
        method,
        input,
        request,
        response,
        logger,
        ctx,
      });
      if (response.writableEnded) return;
      if (method === ("options" satisfies CORSMethod))
        return void response.status(200).end();
      result = {
        output: await this.#parseOutput(
          await this.#parseAndRunHandler({
            input,
            logger,
            ctx: ctx as CTX, // ensured the complete CTX by writableEnded condition and try-catch
          }),
        ),
        error: null,
      };
    } catch (e) {
      result = { output: null, error: ensureError(e) };
    }
    await this.#handleResult({
      ...result,
      input,
      request,
      response,
      logger,
      ctx,
    });
  }
}
