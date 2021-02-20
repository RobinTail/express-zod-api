import {HttpError} from 'http-errors';
import * as z from 'zod';
import {logger} from './logger';
import {Request, Response} from 'express';


interface MiddlewareParams<I, P> {
  input: I;
  options: P;
  request: Request;
  response: Response;
}

type Middleware<I, P, NP> = (params: MiddlewareParams<I, P>) => Promise<NP>;

export type Handler<I, O, P> = (params: {
  input: I,
  options: P
}) => Promise<O>;

interface MiddlewareDefinition<I extends z.ZodRawShape, P, NP> {
  input: z.ZodObject<I>;
  middleware: Middleware<z.infer<z.ZodObject<I>>, P, NP>;
}

interface ResultHandlerParams {
  error: Error | null;
  input: any;
  output: any;
  request: Request;
  response: Response;
}

type ResultHandler = (params: ResultHandlerParams) => void | Promise<void>;

type ApiResponse<T> = {
  status: 'success',
  data: T
} | {
  status: 'error',
  error: {
    message: string;
  }
};


const defaultResultHandler = ({error, request, response, input, output}: ResultHandlerParams) => {
  let resultJson: ApiResponse<any>;
  if (error) {
    let statusCode = 500;
    if (error instanceof HttpError) {
      statusCode = error.statusCode;
    }
    if (error instanceof z.ZodError) {
      statusCode = 400;
    }
    if (statusCode === 500) {
      logger.error(
        `Internal server error\n` +
        `${error.stack}\n` +
        `URL: ${request.url}\n` +
        `Payload: ${JSON.stringify(input, null, 2)}`,
        '  '
      );
    }
    response.status(statusCode);
    resultJson = {
      status: 'error',
      error: {
        message: error instanceof z.ZodError
          ? error.issues.map(({path, message}) =>
            `${path.join('/')}: ${message}`).join('; ')
          : error.message,
      }
    };
  } else {
    resultJson = {
      status: 'success',
      data: output
    };
  }
  response.json(resultJson);
}

export abstract class AbstractEndpoint {
  public abstract execute(request: Request, response: Response): Promise<void>;
}

class Endpoint<I extends z.ZodRawShape, O extends z.ZodRawShape, MI, MO> extends AbstractEndpoint {
  protected middlewares: MiddlewareDefinition<any, any, any>[] = [];
  protected inputSchema: z.ZodObject<I>;
  protected outputSchema: z.ZodObject<O>;
  protected handler: Handler<z.infer<z.ZodObject<I>>, z.infer<z.ZodObject<O>>, MO>
  protected resultHandler: ResultHandler;

  constructor({
                middlewares,
                inputSchema,
                outputSchema,
                handler,
                resultHandler
              }: {
    middlewares: MiddlewareDefinition<any, any, any>[],
    inputSchema: z.ZodObject<I>,
    outputSchema: z.ZodObject<O>,
    handler: Handler<z.infer<z.ZodObject<I>>, z.infer<z.ZodObject<O>>, MO>
    resultHandler: ResultHandler | null
  }) {
    super();
    this.middlewares = middlewares;
    this.inputSchema = inputSchema;
    this.outputSchema = outputSchema;
    this.handler = handler;
    this.resultHandler = resultHandler || defaultResultHandler;
  }

  public async execute(request: Request, response: Response) {
    response.set('Access-Control-Allow-Origin', '*');
    response.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.set('Access-Control-Allow-Headers', 'content-type');

    if (request.method === 'OPTIONS') {
      response.end();
      return;
    }

    let error;
    let output;
    let initialInput: any = null;
    try {
      if (request.method === 'POST') {
        initialInput = request.body;
      }
      let input = {...initialInput};
      let options: any = {};
      for (let def of this.middlewares) {
        def.input.parse(input);
        Object.assign(options, await def.middleware({
          input,
          options,
          request,
          response,
        }));
        if (response.writableEnded) {
          return;
        }
      }
      this.inputSchema.parse(input);
      output = await this.handler({
        input,
        options,
      });
    } catch (e) {
      error = e;
    }
    try {
      await this.resultHandler({error, input: initialInput, output, request, response});
    } catch (e) {
      logger.error(`Result handler failure: ${e.message}.`);
      // throw e;
    }
  }
}

export class EndpointBuilder<MI, MO> {
  protected middlewares: MiddlewareDefinition<any, any, any>[] = [];
  protected resultHandler: ResultHandler | null;

  constructor(
    middlewares: MiddlewareDefinition<any, any, any>[] = [],
    resultHandler: ResultHandler | null = null
  ) {
    this.middlewares = middlewares;
    this.resultHandler = resultHandler;
  }

  public setResultHandler(resultHandler: ResultHandler) {
    return new EndpointBuilder<MI, MO>(
      this.middlewares,
      resultHandler
    );
  }

  public addMiddleware<I extends z.ZodRawShape, R>(definition: MiddlewareDefinition<I, MO, R>) {
    return new EndpointBuilder<MI & I, MO & R>(
      this.middlewares.concat(definition),
      this.resultHandler
    );
  }

  public build<I extends z.ZodRawShape, O extends z.ZodRawShape>(params: {
    input: z.ZodObject<I>,
    output: z.ZodObject<O>,
    handler: Handler<z.infer<z.ZodObject<I>>, z.infer<z.ZodObject<O>>, MO>
  }) {
    return new Endpoint<I, O, MI, MO>({
      middlewares: this.middlewares,
      inputSchema: params.input,
      outputSchema: params.output,
      handler: params.handler,
      resultHandler: this.resultHandler
    });
  }
}
