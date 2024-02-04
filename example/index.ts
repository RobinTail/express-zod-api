import { createServer } from "../src";
import { createSockets } from "../src/sockets";
import { config } from "./config";
import { clientActions, routing } from "./routing";
import { Server } from "socket.io";

/**
 * "await" is only needed for using entities retuned from this method.
 * If you can not use await (on the top level of CJS), use IIFE wrapper:
 * @example (async () => { await ... })()
 * */
const { httpServer, logger } = await createServer(config, routing);

createSockets({
  Class: Server,
  server: httpServer,
  clientEvents: clientActions,
  logger,
});
