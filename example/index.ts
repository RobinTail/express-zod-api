import { createServer } from "../src";
import { attachSockets } from "../src/sockets";
import { config } from "./config";
import { actions, routing } from "./routing";
import { Server } from "socket.io";

/**
 * "await" is only needed for using entities retuned from this method.
 * If you can not use await (on the top level of CJS), use IIFE wrapper:
 * @example (async () => { await ... })()
 * */
const { httpServer, logger } = await createServer(config, routing);

attachSockets({
  io: new Server(),
  target: httpServer,
  actions,
  logger,
  config,
});
