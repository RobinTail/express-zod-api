import {Request, Response} from 'express';
import {Logger} from 'winston';
import {z} from 'zod';
import {ConfigType} from './config-type';
import {combineEndpointAndMiddlewareInputSchemas, getInitialInput, IOSchema, Merge} from './helpers';
import {Method, MethodsDefinition} from './method';
import {MiddlewareDefinition} from './middleware';
import {defaultResultHandler, ResultHandler} from './result-handler';

export type Handler<IN, OUT, OPT> = (params: {
  input: IN,
  options: OPT,
  logger: Logger
}) => Promise<OUT>;

export abstract class AbstractEndpoint {
  protected methods: Method[] = [];
  protected description?: string;

  public abstract execute(params: {
    request: Request,
    response: Response,
    logger: Logger,
    config: ConfigType
  }): Promise<void>;

  public getMethods() {
    return this.methods;
  }

  public getDescription() {
    return this.description;
  }

  abstract getInputSchema(): IOSchema;
  abstract getOutputSchema(): IOSchema;
}

export type EndpointInput<T> = T extends Endpoint<infer IN, any, infer mIN, any> ? z.input<Merge<IN, mIN>> : never;

export type EndpointOutput<T> = T extends Endpoint<any, infer OUT, any, any> ? z.output<OUT> : never;

type EndpointProps<IN extends IOSchema, OUT extends IOSchema, mIN, OPT> = {
  middlewares: MiddlewareDefinition<any, any, any>[];
  inputSchema: IN;
  outputSchema: OUT;
  handler: Handler<z.output<Merge<IN, mIN>>, z.input<OUT>, OPT>;
  resultHandler: ResultHandler | null;
  description?: string;
} & MethodsDefinition;

/** mIN, OPT - from Middlewares */
export class Endpoint<IN extends IOSchema, OUT extends IOSchema, mIN, OPT> extends AbstractEndpoint {
  protected middlewares: MiddlewareDefinition<any, any, any>[] = [];
  protected inputSchema: Merge<IN, mIN>; // combined with middlewares input
  protected outputSchema: OUT;
  protected handler: Handler<z.output<Merge<IN, mIN>>, z.input<OUT>, OPT>
  protected resultHandler: ResultHandler | null;

  constructor({
    middlewares, inputSchema, outputSchema, handler, resultHandler, description, ...rest
  }: EndpointProps<IN, OUT, mIN, OPT>) {
    super();
    this.methods = 'methods' in rest ? rest.methods : [rest.method];
    this.middlewares = middlewares;
    this.inputSchema = combineEndpointAndMiddlewareInputSchemas<IN, mIN>(inputSchema, middlewares);
    this.outputSchema = outputSchema;
    this.handler = handler;
    this.resultHandler = resultHandler;
    this.description = description;
  }

  public getInputSchema(): IOSchema {
    return this.inputSchema;
  }

  public getOutputSchema(): IOSchema {
    return this.outputSchema;
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

  private async handleResult({config, error, request, response, logger, initialInput, output}: {
    config: ConfigType,
    error: Error | null,
    request: Request,
    response: Response,
    logger: Logger,
    initialInput: any,
    output: any
  }) {
    const resultHandler = this.resultHandler || config.resultHandler || defaultResultHandler;
    try {
      await resultHandler({
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
      response, error, logger, config
    });
  }
}

