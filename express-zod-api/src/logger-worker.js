import { parentPort } from "node:worker_threads";

if (!parentPort)
  throw new Error("Logger worker must be run as a Worker Thread.");

/**
 * @param {string[]} output
 */
const onMessage = (output) => console.log(output.join(" "));

parentPort.on("message", onMessage);
