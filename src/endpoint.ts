import {Logger} from 'winston';
import {ZodError} from 'zod';
import * as z from 'zod';
import {ConfigType} from './config-type';
import {combineEndpointAndMiddlewareInputSchemas, Merge, ObjectSchema} from './helpers';
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

export type EndpointOutput<T> = T extends Endpoint<any, infer OUT, any, any> ? z.infer<OUT> : never;

/** mIN, OPT - from Middlewares */
export class Endpoint<IN extends ObjectSchema, OUT extends ObjectSchema, mIN, OPT> extends AbstractEndpoint {
  protected middlewares: MiddlewareDefinition<any, any, any>[] = [];
  protected inputSchema: Merge<IN, mIN>; // combined with middlewares input
  protected outputSchema: OUT;
  protected handler: Handler<z.infer<Merge<IN, mIN>>, z.infer<OUT>, OPT>
  protected resultHandler: ResultHandler | null;

  constructor({methods, middlewares, inputSchema, outputSchema, handler, resultHandler}: {
    methods: Method[];
    middlewares: MiddlewareDefinition<any, any, any>[],
    inputSchema: IN,
    outputSchema: OUT,
    handler: Handler<z.infer<Merge<IN, mIN>>, z.infer<OUT>, OPT>
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

  public async execute({request, response, logger, config}: {
    request: Request,
    response: Response,
    logger: Logger,
    config: ConfigType
  }) {
    if (config.server.cors) {
      const accessMethods = this.methods.map((method) => method.toUpperCase()).concat('OPTIONS').join(', ');
      response.set('Access-Control-Allow-Origin', '*');
      response.set('Access-Control-Allow-Methods', accessMethods);
      response.set('Access-Control-Allow-Headers', 'content-type');
    }

    if (request.method === 'OPTIONS') {
      response.end();
      return;
    }

    let error;
    let output;
    let initialInput: any = null;
    try {
      if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
        initialInput = request.body;
      }
      if (request.method === 'GET') {
        initialInput = request.query;
      }
      if (request.method === 'DELETE') { // _may_ have body
        initialInput = {...request.query, ...request.body};
      }
      let input = {...initialInput};
      const options: any = {};
      for (const def of this.middlewares) {
        input = {...input, ...def.input.parse(input)}; // middleware can transform the input types
        Object.assign(options, await def.middleware({
          input, options, request,
          response, logger
        }));
        if (response.writableEnded) {
          return;
        }
      }
      input = this.inputSchema.parse(input); // final input types transformations for handler
      output = await this.handler({input, options, logger});
      try {
        output = this.outputSchema.parse(output);
      } catch (e) {
        if (e instanceof ZodError) {
          // noinspection ExceptionCaughtLocallyJS
          throw new ZodError([
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
        } else {
          // noinspection ExceptionCaughtLocallyJS
          throw e;
        }
      }
    } catch (e) {
      error = e;
    }
    const resultHandler = this.resultHandler || config.server.resultHandler || defaultResultHandler;
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
}

