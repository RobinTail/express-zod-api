import { createServer } from "../src";
import { loadPeer } from "../src/peer-helpers";
import { createSockets } from "../src/sockets";
import { config } from "./config";
import { clientEvents } from "./events-map";
import { routing } from "./routing";

/**
 * "await" is only needed for using entities retuned from this method.
 * If you can not use await (on the top level of CJS), use IIFE wrapper:
 * @example (async () => { await ... })()
 * */
const { httpServer, logger } = await createServer(config, routing);

createSockets({
  Class: await loadPeer("socket.io", "Server"),
  server: httpServer,
  clientEvents,
  logger,
});
