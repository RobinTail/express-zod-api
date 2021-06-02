import {z} from 'zod';
import {Endpoint, Handler, Method} from './endpoint';
import {FlatObject, IOSchema, Merge} from './helpers';
import {MiddlewareDefinition} from './middleware';
import {ResultHandler} from './result-handler';

type BuildProps<IN extends IOSchema, OUT extends IOSchema, mIN, mOUT> = {
  input: IN;
  output: OUT;
  handler: Handler<z.output<Merge<IN, mIN>>, z.input<OUT>, mOUT>;
  description?: string;
} & ({
  methods: Method[];
} | {
  method: Method;
});

/** mIN, mOUT - accumulated from all middlewares */
export class EndpointsFactory<mIN, mOUT> {
  protected middlewares: MiddlewareDefinition<any, any, any>[] = [];
  protected resultHandler: ResultHandler | null = null;

  private static create<mIN, mOUT>(
    middlewares: MiddlewareDefinition<any, any, any>[],
    resultHandler: ResultHandler | null
  ) {
    const factory = new EndpointsFactory<mIN, mOUT>();
    factory.middlewares = middlewares;
    factory.resultHandler = resultHandler;
    return factory;
  }

  public setResultHandler(resultHandler: ResultHandler) {
    return EndpointsFactory.create<mIN, mOUT>(
      this.middlewares,
      resultHandler
    );
  }

  public addMiddleware<IN extends IOSchema, OUT extends FlatObject>(definition: MiddlewareDefinition<IN, mOUT, OUT>) {
    return EndpointsFactory.create<Merge<IN, mIN>, mOUT & OUT>(
      this.middlewares.concat(definition),
      this.resultHandler
    );
  }

  public build<IN extends IOSchema, OUT extends IOSchema>({
    input, output, handler, description, ...rest
  }: BuildProps<IN, OUT, mIN, mOUT>) {
    return new Endpoint<IN, OUT, mIN, mOUT>({
      handler, description,
      middlewares: this.middlewares,
      inputSchema: input,
      outputSchema: output,
      resultHandler: this.resultHandler,
      ...rest
    });
  }
}
