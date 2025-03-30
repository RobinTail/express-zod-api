import { parentPort } from "node:worker_threads";

if (!parentPort)
  throw new Error("Logger worker must be run as a Worker Thread.");

const buffer = [];

function flush() {
  if (buffer.length > 0) {
    console.log(buffer.join("\n"));
    buffer.length = 0;
  }
}

/**
 * @param {string[]} output
 */
const onMessage = (output) => buffer.push(output.join(" "));

parentPort.on("message", onMessage);
setInterval(flush, 1000);
