import * as z from 'zod';
import {Endpoint, Handler} from './endpoint';
import {JoinUnshaped, Unshape} from './helpers';
import {MiddlewareDefinition} from './middleware';
import {ResultHandler} from './result-handler';

/** mIN, mOUT - accumulated from all middlewares */
export class EndpointsFactory<mIN, mOUT> {
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
    return new EndpointsFactory<mIN, mOUT>(
      this.middlewares,
      resultHandler
    );
  }

  public addMiddleware<IN extends z.ZodRawShape, OUT>(definition: MiddlewareDefinition<IN, mOUT, OUT>) {
    return new EndpointsFactory<mIN & IN, mOUT & OUT>(
      this.middlewares.concat(definition),
      this.resultHandler
    );
  }

  public build<IN extends z.ZodRawShape, OUT extends z.ZodRawShape>(params: {
    input: z.ZodObject<IN>,
    output: z.ZodObject<OUT>,
    handler: Handler<JoinUnshaped<IN, mIN>, Unshape<OUT>, mOUT>
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
