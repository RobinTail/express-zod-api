import {HttpError} from 'http-errors';
import * as z from 'zod';
import {logger} from './logger';
import {Request, Response} from 'express';

type Unshape<T extends z.ZodRawShape> = z.infer<z.ZodObject<T>>;

interface MiddlewareParams<IN, OPT> {
  input: IN;
  options: OPT;
  request: Request;
  response: Response;
}

type Middleware<IN, OPT, OUT> = (params: MiddlewareParams<IN, OPT>) => Promise<OUT>;

export type Handler<IN, OUT, OPT> = (params: {
  input: IN,
  options: OPT
}) => Promise<OUT>;

interface MiddlewareDefinition<IN extends z.ZodRawShape, OPT, OUT> {
  input: z.ZodObject<IN>;
  middleware: Middleware<Unshape<IN>, OPT, OUT>;
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

/** mIN, OPT - from Middlewares */
class Endpoint<IN extends z.ZodRawShape, OUT extends z.ZodRawShape, mIN, OPT> extends AbstractEndpoint {
  protected middlewares: MiddlewareDefinition<any, any, any>[] = [];
  protected inputSchema: z.ZodObject<IN>;
  protected outputSchema: z.ZodObject<OUT>;
  protected handler: Handler<Unshape<IN> & mIN, Unshape<OUT>, OPT>
  protected resultHandler: ResultHandler;

  constructor({middlewares, inputSchema, outputSchema, handler, resultHandler}: {
    middlewares: MiddlewareDefinition<any, any, any>[],
    inputSchema: z.ZodObject<IN>,
    outputSchema: z.ZodObject<OUT>,
    handler: Handler<Unshape<IN> & mIN, Unshape<OUT>, OPT>
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

/** mIN, mOUT - accumulated from all middlewares */
export class EndpointBuilder<mIN, mOUT> {
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
    return new EndpointBuilder<mIN, mOUT>(
      this.middlewares,
      resultHandler
    );
  }

  public addMiddleware<IN extends z.ZodRawShape, OUT>(definition: MiddlewareDefinition<IN, mOUT, OUT>) {
    return new EndpointBuilder<mIN & IN, mOUT & OUT>(
      this.middlewares.concat(definition),
      this.resultHandler
    );
  }

  public build<IN extends z.ZodRawShape, OUT extends z.ZodRawShape>(params: {
    input: z.ZodObject<IN>,
    output: z.ZodObject<OUT>,
    handler: Handler<Unshape<IN> & mIN, Unshape<OUT>, mOUT>
  }) {
    return new Endpoint<IN, OUT, mIN, mOUT>({
      middlewares: this.middlewares,
      inputSchema: params.input,
      outputSchema: params.output,
      handler: params.handler,
      resultHandler: this.resultHandler
    });
  }
}
