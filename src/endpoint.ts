import { Request, Response } from "express";
import { Logger } from "winston";
import { z } from "zod";
import { ApiResponse } from "./api-response";
import { CommonConfig } from "./config-type";
import {
  IOSchemaError,
  InputValidationError,
  OutputValidationError,
  ResultHandlerError,
} from "./errors";
import {
  FlatObject,
  getActualMethod,
  getInput,
  hasTopLevelTransformingEffect,
  hasUpload,
  makeErrorFromAnything,
} from "./common-helpers";
import { IOSchema } from "./io-schema";
import { LogicalContainer, combineContainers } from "./logical-container";
import { AuxMethod, Method, MethodsDefinition } from "./method";
import { AnyMiddlewareDef } from "./middleware";
import { mimeJson, mimeMultipart } from "./mime";
import {
  ResultHandlerDefinition,
  defaultStatusCodes,
  lastResortHandler,
} from "./result-handler";
import { Security } from "./security";

const getMimeTypesFromApiResponse = <S extends z.ZodTypeAny>(
  subject: S | ApiResponse<S>,
  fallback = [mimeJson],
) => {
  if (subject instanceof z.ZodType) {
    return fallback;
  }
  const { mimeTypes, mimeType } = subject;
  return mimeType ? [mimeType] : mimeTypes || fallback;
};

export type Handler<IN, OUT, OPT> = (params: {
  input: IN;
  options: OPT;
  logger: Logger;
}) => Promise<OUT>;

type DescriptionVariant = "short" | "long";
type IOVariant = "input" | "output";
type ResponseVariant = "positive" | "negative";
type MimeVariant = Extract<IOVariant, "input"> | ResponseVariant;

export abstract class AbstractEndpoint {
  public abstract execute(params: {
    request: Request;
    response: Response;
    logger: Logger;
    config: CommonConfig;
  }): Promise<void>;
  public abstract getDescription(
    variant: DescriptionVariant,
  ): string | undefined;
  public abstract getMethods(): Method[];
  public abstract getSchema(variant: IOVariant): IOSchema;
  public abstract getSchema(variant: ResponseVariant): z.ZodTypeAny;
  public abstract getMimeTypes(variant: MimeVariant): string[];
  public abstract getStatusCode(variant: ResponseVariant): number;
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
  POS extends z.ZodTypeAny,
  NEG extends z.ZodTypeAny,
  SCO extends string,
  TAG extends string,
> = {
  middlewares: AnyMiddlewareDef[];
  inputSchema: IN;
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
  POS extends z.ZodTypeAny,
  NEG extends z.ZodTypeAny,
  SCO extends string,
  TAG extends string,
> extends AbstractEndpoint {
  readonly #descriptions: Record<DescriptionVariant, string | undefined>;
  readonly #methods: M[] = [];
  #siblingMethods: Method[] = [];
  readonly #middlewares: AnyMiddlewareDef[] = [];
  readonly #mimeTypes: Record<MimeVariant, string[]>;
  readonly #statusCodes: Record<ResponseVariant, number>;
  readonly #handler: Handler<z.output<IN>, z.input<OUT>, OPT>;
  readonly #resultHandler: ResultHandlerDefinition<POS, NEG>;
  readonly #schemas: {
    input: IN;
    output: OUT;
    positive: POS;
    negative: NEG;
  };
  readonly #scopes: SCO[] = [];
  readonly #tags: TAG[] = [];

  constructor({
    middlewares,
    inputSchema,
    outputSchema,
    handler,
    resultHandler,
    description,
    shortDescription,
    ...rest
  }: EndpointProps<IN, OUT, OPT, M, POS, NEG, SCO, TAG>) {
    super();
    [
      { name: "input schema", schema: inputSchema },
      { name: "output schema", schema: outputSchema },
    ].forEach(({ name, schema }) => {
      if (hasTopLevelTransformingEffect(schema)) {
        throw new IOSchemaError(
          `Using transformations on the top level of endpoint ${name} is not allowed.`,
        );
      }
    });
    this.#middlewares = middlewares;
    const apiResponse = {
      positive: resultHandler.getPositiveResponse(outputSchema),
      negative: resultHandler.getNegativeResponse(),
    };
    this.#mimeTypes = {
      input: hasUpload(inputSchema) ? [mimeMultipart] : [mimeJson],
      positive: getMimeTypesFromApiResponse(apiResponse.positive),
      negative: getMimeTypesFromApiResponse(apiResponse.negative),
    };
    this.#schemas = {
      input: inputSchema,
      output: outputSchema,
      positive:
        apiResponse.positive instanceof z.ZodType
          ? apiResponse.positive
          : apiResponse.positive.schema,
      negative:
        apiResponse.negative instanceof z.ZodType
          ? apiResponse.negative
          : apiResponse.negative.schema,
    };
    this.#statusCodes = {
      positive:
        apiResponse.positive instanceof z.ZodType
          ? defaultStatusCodes.positive
          : apiResponse.positive.statusCode || defaultStatusCodes.positive,
      negative:
        apiResponse.negative instanceof z.ZodType
          ? defaultStatusCodes.negative
          : apiResponse.negative.statusCode || defaultStatusCodes.negative,
    };
    this.#handler = handler;
    this.#resultHandler = resultHandler;
    this.#descriptions = { long: description, short: shortDescription };
    if ("scopes" in rest && rest.scopes) {
      this.#scopes.push(...rest.scopes);
    }
    if ("scope" in rest && rest.scope) {
      this.#scopes.push(rest.scope);
    }
    if ("tags" in rest && rest.tags) {
      this.#tags.push(...rest.tags);
    }
    if ("tag" in rest && rest.tag) {
      this.#tags.push(rest.tag);
    }
    if ("methods" in rest) {
      this.#methods = rest.methods;
    } else {
      this.#methods = [rest.method];
    }
  }

  /**
   * @desc Sets the other methods supported by the same path. Used by Routing in DependsOnMethod case, for options.
   * @deprecated This method is for internal needs of the library, please avoid using it.
   * */
  public override _setSiblingMethods(methods: Method[]): void {
    this.#siblingMethods = methods;
  }

  public override getDescription(variant: DescriptionVariant) {
    return this.#descriptions[variant];
  }

  public override getMethods(): M[] {
    return this.#methods;
  }

  public override getSchema(variant: "input"): IN;
  public override getSchema(variant: "output"): OUT;
  public override getSchema(variant: "positive"): POS;
  public override getSchema(variant: "negative"): NEG;
  public override getSchema(variant: IOVariant | ResponseVariant) {
    return this.#schemas[variant];
  }

  public override getMimeTypes(variant: MimeVariant) {
    return this.#mimeTypes[variant];
  }

  public override getStatusCode(variant: ResponseVariant) {
    return this.#statusCodes[variant];
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

  #getDefaultCorsHeaders(): Record<string, string> {
    const accessMethods = (this.#methods as Array<Method | AuxMethod>)
      .concat(this.#siblingMethods)
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
      return await this.#schemas.output.parseAsync(output);
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
    input: Readonly<any>; // Issue #673: input is immutable, since this.inputSchema is combined with ones of middlewares
    request: Request;
    response: Response;
    logger: Logger;
  }) {
    const options: any = {};
    let isStreamClosed = false;
    for (const def of this.#middlewares) {
      if (method === "options" && def.type === "proprietary") {
        continue;
      }
      let finalInput: any;
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
      isStreamClosed = "writableEnded" in response && response.writableEnded;
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
    input: Readonly<any>;
    options: any;
    logger: Logger;
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
    logger: Logger;
    input: any;
    output: any;
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
