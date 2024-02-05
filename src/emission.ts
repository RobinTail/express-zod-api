import type { Socket } from "socket.io";
import { z } from "zod";
import { InputValidationError, OutputValidationError } from "./errors";
import { AbstractLogger } from "./logger";

export interface Emission {
  schema: z.AnyZodTuple;
  ack?: z.AnyZodTuple;
}

export interface EmissionMap {
  [event: string]: Emission;
}

type TupleOrTrue<T> = T extends z.AnyZodTuple ? T : z.ZodLiteral<true>;

export type Emitter<E extends EmissionMap> = <K extends keyof E>(
  evt: K,
  ...args: z.input<E[K]["schema"]>
) => Promise<z.output<TupleOrTrue<E[K]["ack"]>>>;

export const createEmission = <T extends EmissionMap>(def: T) => def;

export const makeEmitter =
  <E extends EmissionMap>({
    emission,
    logger,
    socket,
  }: {
    emission: E;
    logger: AbstractLogger;
    socket: Socket;
  }): Emitter<E> =>
  async (event, ...args) => {
    const { schema, ack: ackSchema } = emission[event];
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
  };
