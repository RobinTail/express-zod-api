import { parentPort } from "node:worker_threads";

if (!parentPort)
  throw new Error("Logger worker must be run as a Worker Thread.");

/** @type string[] */
const buffer = [];

const flush = () => {
  if (buffer.length === 0) return;
  console.log(buffer.join("\n"));
  buffer.length = 0;
};

/** @param {string} line */
const onMessage = (line) => buffer.push(line);

parentPort.on("message", onMessage);
setInterval(flush, 1000);
