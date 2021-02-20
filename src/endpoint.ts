import {Logger} from 'winston';
import * as z from 'zod';
import {JoinUnshaped, ObjectSchema, Unshape} from './helpers';
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

  public abstract execute(request: Request, response: Response, logger: Logger): Promise<void>;

  public getMethods() {
    return this.methods;
  }
}

export type Method = 'get' | 'post' | 'put' | 'delete' | 'patch';

/** mIN, OPT - from Middlewares */
export class Endpoint<IN extends z.ZodRawShape, OUT extends z.ZodRawShape, mIN, OPT> extends AbstractEndpoint {
  protected middlewares: MiddlewareDefinition<any, any, any>[] = [];
  protected inputSchema: ObjectSchema<IN>;
  protected outputSchema: ObjectSchema<OUT>;
  protected handler: Handler<JoinUnshaped<IN, mIN>, Unshape<OUT>, OPT>
  protected resultHandler: ResultHandler;

  constructor({methods, middlewares, inputSchema, outputSchema, handler, resultHandler}: {
    methods: Method[];
    middlewares: MiddlewareDefinition<any, any, any>[],
    inputSchema: ObjectSchema<IN>,
    outputSchema: ObjectSchema<OUT>,
    handler: Handler<JoinUnshaped<IN, mIN>, Unshape<OUT>, OPT>
    resultHandler: ResultHandler | null
  }) {
    super();
    this.methods = methods;
    this.middlewares = middlewares;
    this.inputSchema = inputSchema;
    this.outputSchema = outputSchema;
    this.handler = handler;
    this.resultHandler = resultHandler || defaultResultHandler;
  }

  public async execute(request: Request, response: Response, logger: Logger) {
    const accessMethods = this.methods.map((method) => method.toUpperCase()).concat('OPTIONS').join(', ');
    response.set('Access-Control-Allow-Origin', '*');
    response.set('Access-Control-Allow-Methods', accessMethods);
    response.set('Access-Control-Allow-Headers', 'content-type');

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
        initialInput = request.query
      }
      if (request.method === 'DELETE') { // _may_ have body
        initialInput = {...request.query, ...request.body};
      }
      let input = {...initialInput};
      let options: any = {};
      logger.debug('input before middle', input);
      for (let def of this.middlewares) {
        input = {...input, ...def.input.parse(input)}; // middleware can transform the input types
        logger.debug('input after middle validation', input);
        Object.assign(options, await def.middleware({
          input, options, request,
          response, logger
        }));
        if (response.writableEnded) {
          return;
        }
      }
      logger.debug('input after middle execution', input);
      input = this.inputSchema.parse(input); // final input types transformations for handler
      output = await this.handler({input, options, logger});
    } catch (e) {
      error = e;
    }
    try {
      await this.resultHandler({
        error, output, request, response, logger,
        input: initialInput
      });
    } catch (e) {
      logger.error(`Result handler failure: ${e.message}.`);
      // throw e;
    }
  }
}

