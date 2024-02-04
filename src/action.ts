import { init, last } from "ramda";
import type { Socket } from "socket.io";
import { z } from "zod";
import { AckActionDef, EmissionMap, SimpleActionDef } from "./actions-factory";
import { InputValidationError, OutputValidationError } from "./errors";
import { AbstractLogger } from "./logger";

export type Handler<IN, OUT, E extends EmissionMap> = (params: {
  input: IN;
  logger: AbstractLogger;
  emit: <K extends keyof E>(
    evt: K,
    ...args: z.input<E[K]["schema"]>
  ) => Promise<
    z.output<
      E[K]["ack"] extends z.AnyZodTuple ? E[K]["ack"] : z.ZodLiteral<true>
    >
  >;
  isConnected: () => boolean;
}) => Promise<OUT>;

export abstract class AbstractAction {
  public abstract execute(params: {
    event: string;
    params: unknown[];
    logger: AbstractLogger;
    socket: Socket;
  }): Promise<void>;
}

export class Action<
  IN extends z.AnyZodTuple,
  OUT extends z.AnyZodTuple,
  E extends EmissionMap,
> extends AbstractAction {
  readonly #inputSchema: IN;
  readonly #outputSchema: OUT | undefined;
  readonly #handler: Handler<z.output<IN>, z.input<OUT> | void, E>;
  readonly #emission: E;

  public constructor(
    action: AckActionDef<IN, OUT, E> | SimpleActionDef<IN, E>,
    emission: E,
  ) {
    super();
    this.#inputSchema = action.input;
    this.#outputSchema = "output" in action ? action.output : undefined;
    this.#handler = action.handler;
    this.#emission = emission;
  }

  async #emit<K extends keyof E>({
    event,
    args,
    logger,
    socket,
  }: {
    event: K;
    args: z.input<E[K]["schema"]>;
    logger: AbstractLogger;
    socket: Socket;
  }): Promise<
    z.output<
      E[K]["ack"] extends z.AnyZodTuple ? E[K]["ack"] : z.ZodLiteral<true>
    >
  > {
    const { schema, ack: ackSchema } = this.#emission[event];
    const emitValidation = schema.safeParse(args);
    if (!emitValidation.success) {
      return logger.error(
        `${String(event)} emission validation error`,
        new OutputValidationError(emitValidation.error),
      );
    }
    logger.debug(`Emitting ${String(event)}`, emitValidation.data);
    if (!ackSchema) {
      return socket.emit(String(event), ...emitValidation.data) || true;
    }
    try {
      const ack = await socket
        .timeout(2000) // @todo configurable?
        .emitWithAck(String(event), ...emitValidation.data);
      return ackSchema.parse(ack);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new InputValidationError(error);
      }
      throw error;
    }
  }

  public override async execute({
    event,
    params,
    logger,
    socket,
  }: {
    event: string;
    params: unknown[];
    logger: AbstractLogger;
    socket: Socket;
  }): Promise<void> {
    const payload = this.#outputSchema ? init(params) : params;
    const inputValidation = this.#inputSchema.safeParse(payload);
    if (!inputValidation.success) {
      return logger.error(
        `${event} payload validation error`,
        new InputValidationError(inputValidation.error),
      );
    }
    logger.debug(
      `parsed input (${this.#outputSchema ? "excl." : "no"} ack)`,
      inputValidation.data,
    );
    const ackValidation = this.#outputSchema
      ? z.function(this.#outputSchema, z.void()).safeParse(last(params))
      : undefined;
    if (ackValidation && !ackValidation.success) {
      return logger.error(
        `${event} acknowledgement validation error`,
        new InputValidationError(ackValidation.error),
      );
    }
    const ack = ackValidation?.data;
    const output = await this.#handler({
      input: inputValidation.data,
      logger,
      emit: (evt, ...args) => this.#emit({ event: evt, args, logger, socket }),
      isConnected: () => socket.connected,
    });
    if (!this.#outputSchema) {
      return; // no ack
    }
    const outputValidation = this.#outputSchema.safeParse(output);
    if (!outputValidation.success) {
      return logger.error(
        `${event} output validation error`,
        new OutputValidationError(outputValidation.error),
      );
    }
    logger.debug("parsed output", outputValidation.data);
    if (ack) {
      ack(...outputValidation.data);
    }
  }
}
