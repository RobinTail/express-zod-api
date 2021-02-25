import * as z from 'zod';
import {Endpoint, Handler, Method} from './endpoint';
import {FlatObject, JoinUnshaped, ObjectSchema, Unshape} from './helpers';
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

  public addMiddleware<IN extends z.ZodRawShape, OUT extends FlatObject>(definition: MiddlewareDefinition<IN, mOUT, OUT>) {
    return new EndpointsFactory<mIN & IN, mOUT & OUT>(
      this.middlewares.concat(definition),
      this.resultHandler
    );
  }

  public build<IN extends z.ZodRawShape, OUT extends z.ZodRawShape>({methods, input, output, handler}: {
    methods: Method[],
    input: ObjectSchema<IN>,
    output: ObjectSchema<OUT>,
    handler: Handler<JoinUnshaped<IN, mIN>, Unshape<OUT>, mOUT>
  }) {
    return new Endpoint<IN, OUT, mIN, mOUT>({
      methods, handler,
      middlewares: this.middlewares,
      inputSchema: input,
      outputSchema: output,
      resultHandler: this.resultHandler
    });
  }
}
