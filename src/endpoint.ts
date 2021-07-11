import {Request, Response} from 'express';
import {Logger} from 'winston';
import {z} from 'zod';
import {ConfigType} from './config-type';
import {
  ApiResponse,
  combineEndpointAndMiddlewareInputSchemas,
  getInitialInput,
  IOSchema,
  Merge,
  OutputMarker,
  ReplaceMarkerInShape
} from './helpers';
import {Method, MethodsDefinition} from './method';
import {MiddlewareDefinition} from './middleware';
import {ResultHandlerDefinition} from './result-handler';

export type Handler<IN, OUT, OPT> = (params: {
  input: IN,
  options: OPT,
  logger: Logger
}) => Promise<OUT>;

export abstract class AbstractEndpoint {
  protected description?: string;

  public abstract execute(params: {
    request: Request,
    response: Response,
    logger: Logger,
    config: ConfigType
  }): Promise<void>;

  public getDescription() {
    return this.description;
  }

  public abstract getMethods(): Method[];
  public abstract getInputSchema(): IOSchema;
  public abstract getOutputSchema(): IOSchema;
  public abstract getPositiveResponseSchema(): z.ZodTypeAny;
  public abstract getNegativeResponseSchema(): z.ZodTypeAny;
  public abstract getPositiveMimeTypes(): string[];
  public abstract getNegativeMimeTypes(): string[];
}

export type EndpointInput<T> = T extends Endpoint<infer IN, any, infer mIN, any, any, any, any>
  ? z.input<Merge<IN, mIN>> : never;

export type EndpointOutput<T> = T extends Endpoint<any, infer OUT, any, any, any, any, any>
  ? z.output<OUT> : never;

export type EndpointResponse<E extends AbstractEndpoint> = z.output<
  ReturnType<E['getPositiveResponseSchema']> extends z.ZodObject<z.ZodRawShape> // in object response
    ? z.ZodObject<
      ReplaceMarkerInShape<
        ReturnType<E['getPositiveResponseSchema']>['_shape'],
        ReturnType<E['getOutputSchema']>
      >
    >
    : ReturnType<E['getPositiveResponseSchema']> extends OutputMarker // "as is" response
    ? ReturnType<E['getOutputSchema']>
    : never
> | z.output<ReturnType<E['getNegativeResponseSchema']>>;

type EndpointProps<
  IN extends IOSchema, OUT extends IOSchema, mIN, OPT,
  M extends Method, POS extends ApiResponse, NEG extends ApiResponse
> = {
  middlewares: MiddlewareDefinition<any, any, any>[];
  inputSchema: IN;
  outputSchema: OUT;
  handler: Handler<z.output<Merge<IN, mIN>>, z.input<OUT>, OPT>;
  resultHandler: ResultHandlerDefinition<POS, NEG>;
  description?: string;
} & MethodsDefinition<M>;

/** mIN, OPT - from Middlewares */
export class Endpoint<
  IN extends IOSchema, OUT extends IOSchema, mIN, OPT,
  M extends Method, POS extends ApiResponse, NEG extends ApiResponse
> extends AbstractEndpoint {
  protected methods: M[] = [];
  protected middlewares: MiddlewareDefinition<any, any, any>[] = [];
  protected inputSchema: Merge<IN, mIN>; // combined with middlewares input
  protected outputSchema: OUT;
  protected handler: Handler<z.output<Merge<IN, mIN>>, z.input<OUT>, OPT>
  protected resultHandler: ResultHandlerDefinition<POS, NEG>;

  constructor({
    middlewares, inputSchema, outputSchema, handler, resultHandler, description, ...rest
  }: EndpointProps<IN, OUT, mIN, OPT, M, POS, NEG>) {
    super();
    this.middlewares = middlewares;
    this.inputSchema = combineEndpointAndMiddlewareInputSchemas<IN, mIN>(inputSchema, middlewares);
    this.outputSchema = outputSchema;
    this.handler = handler;
    this.resultHandler = resultHandler;
    this.description = description;
    if ('methods' in rest) {
      this.methods = rest.methods;
    } else {
      this.methods = [rest.method];
    }
  }

  public getMethods(): M[] {
    return this.methods;
  }

  public getInputSchema(): Merge<IN, mIN> {
    return this.inputSchema;
  }

  public getOutputSchema(): OUT {
    return this.outputSchema;
  }

  public getPositiveResponseSchema(): POS['schema'] {
    return this.resultHandler.getPositiveResponse(this.outputSchema).schema;
  }

  public getNegativeResponseSchema(): NEG['schema'] {
    return this.resultHandler.getNegativeResponse().schema;
  }

  public getNegativeMimeTypes() {
    return this.resultHandler.getPositiveResponse(this.outputSchema).mimeTypes;
  }

  public getPositiveMimeTypes() {
    return this.resultHandler.getNegativeResponse().mimeTypes;
  }

  private setupCorsHeaders(response: Response) {
    const accessMethods = this.methods.map((method) => method.toUpperCase()).concat('OPTIONS').join(', ');
    response.set('Access-Control-Allow-Origin', '*');
    response.set('Access-Control-Allow-Methods', accessMethods);
    response.set('Access-Control-Allow-Headers', 'content-type');
  }

  private parseOutput(output: any) {
    try {
      return this.outputSchema.parse(output);
    } catch (e) {
      if (e instanceof z.ZodError) {
        throw new z.ZodError([
          {
            message: 'Invalid format',
            code: 'custom',
            path: ['output'],
          },
          ...e.issues.map((issue) => ({
            ...issue,
            path: issue.path.length === 0 ? ['output'] : issue.path
          }))
        ]);
      }
      throw e;
    }
  }

  private async runMiddlewares({input, request, response, logger}: {
    input: any,
    request: Request,
    response: Response,
    logger: Logger
  }) {
    const options: any = {};
    for (const def of this.middlewares) {
      input = {...input, ...def.input.parse(input)}; // middleware can transform the input types
      Object.assign(options, await def.middleware({
        input, options, request,
        response, logger
      }));
      if (response.writableEnded) {
        break;
      }
    }
    return {input, options, isStreamClosed: response.writableEnded};
  }

  private async parseAndRunHandler({input, options, logger}: {input: any, options: any, logger: Logger}) {
    return await this.handler({
      input: this.inputSchema.parse(input), // final input types transformations for handler,
      options, logger
    });
  }

  private async handleResult({error, request, response, logger, initialInput, output}: {
    error: Error | null,
    request: Request,
    response: Response,
    logger: Logger,
    initialInput: any,
    output: any
  }) {
    try {
      await this.resultHandler.resultHandler({
        error, output, request, response, logger,
        input: initialInput
      });
    } catch (e) {
      logger.error(`Result handler failure: ${e.message}.`);
      // throw e;
    }
  }

  public async execute({request, response, logger, config}: {
    request: Request,
    response: Response,
    logger: Logger,
    config: ConfigType
  }) {
    let output: any;
    let error: Error | null = null;
    if (config.cors) {
      this.setupCorsHeaders(response);
    }
    if (request.method === 'OPTIONS') {
      return response.end();
    }
    const initialInput = getInitialInput(request);
    try {
      const {input, options, isStreamClosed} = await this.runMiddlewares({
        input: {...initialInput}, // preserve the initial
        request, response, logger
      });
      if (isStreamClosed) {
        return;
      }
      output = this.parseOutput(
        await this.parseAndRunHandler({input, options, logger})
      );
    } catch (e) {
      error = e;
    }
    await this.handleResult({
      initialInput, output, request,
      response, error, logger
    });
  }
}

