import {z} from 'zod';
import {Endpoint, Handler} from './endpoint';
import {ApiResponse, FlatObject, IOSchema, Merge} from './helpers';
import {Method, MethodsDefinition} from './method';
import {MiddlewareDefinition} from './middleware';
import {defaultResultHandler, ResultHandlerDefinition} from './result-handler';

type BuildProps<IN extends IOSchema, OUT extends IOSchema, mIN, mOUT, M extends Method> = {
  input: IN;
  output: OUT;
  handler: Handler<z.output<Merge<IN, mIN>>, z.input<OUT>, mOUT>;
  description?: string;
} & MethodsDefinition<M>;

/** mIN, mOUT - accumulated from all middlewares */
export class EndpointsFactory<mIN, mOUT, POS extends ApiResponse, NEG extends ApiResponse> {
  protected middlewares: MiddlewareDefinition<any, any, any>[] = [];

  constructor(protected resultHandler: ResultHandlerDefinition<POS, NEG>) {
    this.resultHandler = resultHandler;
  }

  private static create<cmIN, cmOUT, cPOS extends ApiResponse, cNEG extends ApiResponse>(
    middlewares: MiddlewareDefinition<any, any, any>[],
    resultHandler: ResultHandlerDefinition<cPOS, cNEG>
  ) {
    const factory = new EndpointsFactory<cmIN, cmOUT, cPOS, cNEG>(resultHandler);
    factory.middlewares = middlewares;
    return factory;
  }

  public addMiddleware<IN extends IOSchema, OUT extends FlatObject>(
    definition: MiddlewareDefinition<IN, mOUT, OUT>
  ) {
    return EndpointsFactory.create<Merge<IN, mIN>, mOUT & OUT, POS, NEG>(
      this.middlewares.concat(definition),
      this.resultHandler
    );
  }

  public build<IN extends IOSchema, OUT extends IOSchema, M extends Method>({
    input, output, handler, description, ...rest
  }: BuildProps<IN, OUT, mIN, mOUT, M>) {
    return new Endpoint<IN, OUT, mIN, mOUT, M, POS, NEG>({
      handler, description,
      middlewares: this.middlewares,
      inputSchema: input,
      outputSchema: output,
      resultHandler: this.resultHandler,
      ...rest
    });
  }
}

export const defaultEndpointsFactory = new EndpointsFactory(defaultResultHandler);
