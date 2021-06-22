import {Request, Response} from 'express';
import {Logger} from 'winston';
import {z} from 'zod';
import {ConfigType} from './config-type';
import {combineEndpointAndMiddlewareInputSchemas, getInitialInput, IOSchema, Merge} from './helpers';
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

  abstract getMethods(): Method[];
  abstract getInputSchema(): IOSchema;
  abstract getOutputSchema(): IOSchema;
  abstract getPositiveResponseSchema(): z.ZodTypeAny;
  abstract getNegativeResponseSchema(): z.ZodTypeAny;
}

export type EndpointInput<T> = T extends Endpoint<infer IN, any, infer mIN, any, any, any, any>
  ? z.input<Merge<IN, mIN>> : never;

export type EndpointOutput<T> = T extends Endpoint<any, infer OUT, any, any, any, any, any>
  ? z.output<OUT> : never;

/*
export type EndpointResponse<T> = T extends Endpoint<any, any, any, any, any, any, any> ?
  z.output<ReturnType<T['getPositiveResponseSchema']>> | z.output<ReturnType<T['getNegativeResponseSchema']>> : never;
*/

type EndpointProps<
  IN extends IOSchema, OUT extends IOSchema,
  mIN, OPT, M extends Method, POS extends z.ZodTypeAny, NEG extends z.ZodTypeAny
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
  M extends Method, POS extends z.ZodTypeAny, NEG extends z.ZodTypeAny
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

  public getPositiveResponseSchema() {
    return this.resultHandler.getPositiveResponse(this.outputSchema);
  }

  public getNegativeResponseSchema() {
    return this.resultHandler.getNegativeResponse();
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

