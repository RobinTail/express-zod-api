import { z } from "zod";
import { ApiResponse } from "./api-response";
import { Endpoint, Handler } from "./endpoint";
import { FlatObject, IOSchema, hasUpload, Merge } from "./common-helpers";
import { Method, MethodsDefinition } from "./method";
import { MiddlewareDefinition } from "./middleware";
import { mimeJson, mimeMultipart } from "./mime";
import {
  defaultResultHandler,
  ResultHandlerDefinition,
} from "./result-handler";

type BuildProps<
  IN extends IOSchema,
  OUT extends IOSchema,
  MwIN,
  MwOUT,
  M extends Method
> = {
  input: IN;
  output: OUT;
  handler: Handler<z.output<Merge<IN, MwIN>>, z.input<OUT>, MwOUT>;
  description?: string;
  /** @deprecated the factory automatically detects the usage of z.upload() within the input schema */
  type?: "json" | "upload"; // @todo remove in v4
} & MethodsDefinition<M>;

export class EndpointsFactory<
  MwIN,
  MwOUT,
  POS extends ApiResponse,
  NEG extends ApiResponse
> {
  protected middlewares: MiddlewareDefinition<any, any, any>[] = [];

  constructor(protected resultHandler: ResultHandlerDefinition<POS, NEG>) {
    this.resultHandler = resultHandler;
  }

  static #create<
    CrMwIN,
    CrMwOUT,
    CrPOS extends ApiResponse,
    CrNEG extends ApiResponse
  >(
    middlewares: MiddlewareDefinition<any, any, any>[],
    resultHandler: ResultHandlerDefinition<CrPOS, CrNEG>
  ) {
    const factory = new EndpointsFactory<CrMwIN, CrMwOUT, CrPOS, CrNEG>(
      resultHandler
    );
    factory.middlewares = middlewares;
    return factory;
  }

  public addMiddleware<IN extends IOSchema, OUT extends FlatObject>(
    definition: MiddlewareDefinition<IN, MwOUT, OUT>
  ) {
    return EndpointsFactory.#create<Merge<IN, MwIN>, MwOUT & OUT, POS, NEG>(
      this.middlewares.concat(definition),
      this.resultHandler
    );
  }

  public build<IN extends IOSchema, OUT extends IOSchema, M extends Method>({
    input,
    output,
    handler,
    description,
    type, // @todo remove in v4
    ...rest
  }: BuildProps<IN, OUT, MwIN, MwOUT, M>) {
    return new Endpoint<IN, OUT, MwIN, MwOUT, M, POS, NEG>({
      handler,
      description,
      middlewares: this.middlewares,
      inputSchema: input,
      outputSchema: output,
      resultHandler: this.resultHandler,
      mimeTypes: hasUpload(input) ? [mimeMultipart] : [mimeJson],
      ...rest,
    });
  }
}

export const defaultEndpointsFactory = new EndpointsFactory(
  defaultResultHandler
);
