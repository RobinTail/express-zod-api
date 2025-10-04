import type { Request, Response } from "express";
import * as R from "ramda";
import { z, globalRegistry } from "zod";
import type { NormalizedResponse, ResponseVariant } from "./api-response.ts";
import { findRequestTypeDefiningSchema } from "./deep-checks.ts";
import {
  type FlatObject,
  getActualMethod,
  getInput,
  ensureError,
  isSchema,
} from "./common-helpers.ts";
import type { CommonConfig } from "./config-type.ts";
import {
  InputValidationError,
  OutputValidationError,
  ResultHandlerError,
} from "./errors.ts";
import { ezFormBrand } from "./form-schema.ts";
import type { IOSchema } from "./io-schema.ts";
import { lastResortHandler } from "./last-resort.ts";
import type { ActualLogger } from "./logger-helpers.ts";
import type { LogicalContainer } from "./logical-container.ts";
import { getBrand } from "@express-zod-api/zod-plugin";
import type { ClientMethod, CORSMethod, Method, SomeMethod } from "./method.ts";
import { type AbstractMiddleware, ExpressMiddleware } from "./middleware.ts";
import type { ContentType } from "./content-type.ts";
import { ezRawBrand } from "./raw-schema.ts";
import {
  type DiscriminatedResult,
  pullResponseExamples,
} from "./result-helpers.ts";
import { Routable } from "./routable.ts";
import type { AbstractResultHandler } from "./result-handler.ts";
import type { Security } from "./security.ts";
import { ezUploadBrand } from "./upload-schema.ts";

export type Handler<IN, OUT, OPT> = (params: {
  /** @desc The inputs from the enabled input sources validated against the final input schema (incl. Middlewares) */
  input: IN;
  /** @desc The returns of the assigned Middlewares */
  options: OPT;
  /** @desc The instance of the configured logger */
  logger: ActualLogger;
}) => Promise<OUT>;

export abstract class AbstractEndpoint extends Routable {
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
  OPT extends FlatObject,
> extends AbstractEndpoint {
  readonly #def: ConstructorParameters<typeof Endpoint<IN, OUT, OPT>>[0];

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
    handler: Handler<z.output<IN>, z.input<OUT>, OPT>;
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
    inc?: Partial<ConstructorParameters<typeof Endpoint<IN, OUT, OPT>>[0]>,
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
    options,
    response,
    ...rest
  }: {
    method: SomeMethod;
    input: Readonly<FlatObject>; // Issue #673: input is immutable, since this.inputSchema is combined with ones of middlewares
    request: Request;
    response: Response;
    logger: ActualLogger;
    options: Partial<OPT>;
  }) {
    for (const mw of this.#def.middlewares || []) {
      if (
        method === ("options" satisfies CORSMethod) &&
        !(mw instanceof ExpressMiddleware)
      )
        continue;
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

  async #handleResult(
    params: DiscriminatedResult & {
      request: Request;
      response: Response;
      logger: ActualLogger;
      input: FlatObject;
      options: Partial<OPT>;
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
    const options: Partial<OPT> = {};
    let result: DiscriminatedResult = { output: {}, error: null };
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
      if (method === ("options" satisfies CORSMethod))
        return void response.status(200).end();
      result = {
        output: await this.#parseOutput(
          await this.#parseAndRunHandler({
            input,
            logger,
            options: options as OPT, // ensured the complete OPT by writableEnded condition and try-catch
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
      options,
    });
  }
}
