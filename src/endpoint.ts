import {Logger} from 'winston';
import {z} from 'zod';
import {ConfigType} from './config-type';
import {combineEndpointAndMiddlewareInputSchemas, getInitialInput, Merge, ObjectSchema} from './helpers';
import {Request, Response} from 'express';
import {MiddlewareDefinition} from './middleware';
import {defaultResultHandler, ResultHandler} from './result-handler';

export type Handler<IN, OUT, OPT> = (params: {
  input: IN,
  options: OPT,
  logger: Logger
}) => Promise<OUT>;

export abstract class AbstractEndpoint {
  protected methods: Method[];

  public abstract execute(params: {
    request: Request,
    response: Response,
    logger: Logger,
    config: ConfigType
  }): Promise<void>;

  public getMethods() {
    return this.methods;
  }

  abstract getInputSchema(): ObjectSchema;
  abstract getOutputSchema(): ObjectSchema;
}

export type Method = 'get' | 'post' | 'put' | 'delete' | 'patch';

export type EndpointInput<T> = T extends Endpoint<infer IN, any, infer mIN, any> ? z.input<Merge<IN, mIN>> : never;

export type EndpointOutput<T> = T extends Endpoint<any, infer OUT, any, any> ? z.output<OUT> : never;

/** mIN, OPT - from Middlewares */
export class Endpoint<IN extends ObjectSchema, OUT extends ObjectSchema, mIN, OPT> extends AbstractEndpoint {
  protected middlewares: MiddlewareDefinition<any, any, any>[] = [];
  protected inputSchema: Merge<IN, mIN>; // combined with middlewares input
  protected outputSchema: OUT;
  protected handler: Handler<z.output<Merge<IN, mIN>>, z.input<OUT>, OPT>
  protected resultHandler: ResultHandler | null;

  constructor({methods, middlewares, inputSchema, outputSchema, handler, resultHandler}: {
    methods: Method[];
    middlewares: MiddlewareDefinition<any, any, any>[],
    inputSchema: IN,
    outputSchema: OUT,
    handler: Handler<z.output<Merge<IN, mIN>>, z.input<OUT>, OPT>
    resultHandler: ResultHandler | null
  }) {
    super();
    this.methods = methods;
    this.middlewares = middlewares;
    this.inputSchema = combineEndpointAndMiddlewareInputSchemas<IN, mIN>(inputSchema, middlewares);
    this.outputSchema = outputSchema;
    this.handler = handler;
    this.resultHandler = resultHandler;
  }

  public getInputSchema(): ObjectSchema {
    return this.inputSchema;
  }

  public getOutputSchema(): ObjectSchema {
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

