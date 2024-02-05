import { init, last } from "ramda";
import type { Socket } from "socket.io";
import { z } from "zod";
import { AckActionDef, SimpleActionDef } from "./actions-factory";
import { EmissionMap, Emitter } from "./emission";
import { InputValidationError, OutputValidationError } from "./errors";
import { AbstractLogger } from "./logger";

interface SocketFeatures {
  isConnected: () => boolean;
  socketId: Socket["id"];
}

export type Handler<IN, OUT, E extends EmissionMap> = (
  params: {
    input: IN;
    logger: AbstractLogger;
    emit: Emitter<E>;
  } & SocketFeatures,
) => Promise<OUT>;

export abstract class AbstractAction {
  public abstract execute(
    params: {
      event: string;
      params: unknown[];
      logger: AbstractLogger;
      emit: Emitter<EmissionMap>;
    } & SocketFeatures,
  ): Promise<void>;
}

export class Action<
  IN extends z.AnyZodTuple,
  OUT extends z.AnyZodTuple,
> extends AbstractAction {
  readonly #inputSchema: IN;
  readonly #outputSchema: OUT | undefined;
  readonly #handler: Handler<z.output<IN>, z.input<OUT> | void, EmissionMap>;

  public constructor(
    action:
      | AckActionDef<IN, OUT, EmissionMap>
      | SimpleActionDef<IN, EmissionMap>,
  ) {
    super();
    this.#inputSchema = action.input;
    this.#outputSchema = "output" in action ? action.output : undefined;
    this.#handler = action.handler;
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
    emit,
    ...rest
  }: {
    event: string;
    params: unknown[];
    logger: AbstractLogger;
    emit: Emitter<EmissionMap>;
  } & SocketFeatures): Promise<void> {
    try {
      const input = this.#parseInput(params);
      logger.debug(
        `parsed input (${this.#outputSchema ? "excl." : "no"} ack)`,
        input,
      );
      const ack = this.#parseAckCb(params);
      const output = await this.#handler({ input, logger, emit, ...rest });
      const response = this.#parseOutput(output);
      if (ack && response) {
        logger.debug("parsed output", response);
        ack(...response);
      }
    } catch (error) {
      logger.error(`${event} handling error`, error);
    }
  }
}
