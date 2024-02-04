import { init, last } from "ramda";
import type {
  Server as SocketServer,
  ServerOptions as SocketServerOptions,
} from "socket.io";
import { z } from "zod";
import { InputValidationError, OutputValidationError } from "./errors";
import { EventDefinifion } from "./events-factory";
import { AbstractLogger } from "./logger";

export const createSockets = <
  Client extends Record<
    string,
    EventDefinifion<z.ZodTuple, z.ZodTuple | undefined>
  >,
>({
  Class,
  options,
  clientEvents,
  logger,
}: {
  Class: { new (opt?: Partial<SocketServerOptions>): SocketServer };
  options: Partial<SocketServerOptions>;
  clientEvents: Client;
  logger: AbstractLogger;
}): SocketServer => {
  const io = new Class(options);
  io.on("connection", (socket) => {
    logger.debug("User connected", socket.id);
    socket.onAny((event, ...payload) => {
      logger.info(event, payload);
    });
    for (const [event, def] of Object.entries(clientEvents)) {
      socket.on(event, async (...params) => {
        const payload = def.output ? init(params) : params;
        const ack = def.output ? last(params) : undefined;
        const inputValidation = def.input.safeParse(payload);
        if (!inputValidation.success) {
          return logger.error(
            `${event} payload validation error`,
            new InputValidationError(inputValidation.error),
          );
        }
        logger.debug("parsed input", inputValidation.data);
        const output = await def.handler(...inputValidation.data);
        if (!def.output) {
          return; // no ack
        }
        const outputValidation = def.output.safeParse(output);
        if (!outputValidation.success) {
          return logger.error(
            `${event} output validation error`,
            new OutputValidationError(outputValidation.error),
          );
        }
        logger.debug("parsed output", outputValidation.data);
        // @todo use z.function() validation
        if (typeof ack === "function") {
          ack(outputValidation.data);
        }
      });
    }
    socket.on("disconnect", () => {
      logger.debug("User disconnected", socket.id);
    });
  });
  return io;
};
