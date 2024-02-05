import { init, last } from "ramda";
import type { Socket } from "socket.io";
import { z } from "zod";
import { AckActionDef, SimpleActionDef } from "./actions-factory";
import { EmissionMap } from "./emission";
import { InputValidationError, OutputValidationError } from "./errors";
import { AbstractLogger } from "./logger";

type TupleOrTrue<T> = T extends z.AnyZodTuple ? T : z.ZodLiteral<true>;
type Emitter<E extends EmissionMap, K extends keyof E = keyof E> = (
  evt: K,
  ...args: z.input<E[K]["schema"]>
) => Promise<z.output<TupleOrTrue<E[K]["ack"]>>>;

export type Handler<IN, OUT, E extends EmissionMap> = (params: {
  input: IN;
  logger: AbstractLogger;
  emit: Emitter<E>;
  isConnected: () => boolean;
  socketId: Socket["id"];
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
  }): ReturnType<Emitter<E, K>> {
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

  /** @throws InputValidationError */
  #parseInput(params: unknown[]) {
    try {
      const payload = this.#outputSchema ? init(params) : params;
      return this.#inputSchema.parse(payload);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new InputValidationError(error);
      }
      throw error;
    }
  }

  /** @throws InputValidationError */
  #parseAckCb(params: unknown[]) {
    if (!this.#outputSchema) {
      return undefined;
    }
    try {
      return z.function(this.#outputSchema, z.void()).parse(last(params));
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new InputValidationError(error);
      }
      throw error;
    }
  }

  /** @throws OutputValidationError */
  #parseOutput(output: z.input<OUT> | void) {
    if (!this.#outputSchema) {
      return;
    }
    try {
      return this.#outputSchema.parse(output) as z.output<OUT>;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new OutputValidationError(error);
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
    try {
      const input = this.#parseInput(params);
      logger.debug(
        `parsed input (${this.#outputSchema ? "excl." : "no"} ack)`,
        input,
      );
      const ack = this.#parseAckCb(params);
      const output = await this.#handler({
        input,
        logger,
        emit: (evt, ...args) =>
          this.#emit({ event: evt, args, logger, socket }),
        isConnected: () => socket.connected,
        socketId: socket.id,
      });
      const response = this.#parseOutput(output);
      logger.debug("parsed output", response);
      if (ack && response) {
        ack(...response);
      }
    } catch (error) {
      logger.error(`${event} handling error`, error);
    }
  }
}
