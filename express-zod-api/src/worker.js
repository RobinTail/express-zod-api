import { clearInterval } from "node:timers";
import { parentPort, workerData } from "node:worker_threads";

if (!parentPort)
  throw new Error("Logger worker must be run as a Worker Thread.");

const { interval = 100 } = { ...workerData };

/** @type string[] */
const buffer = [];

const flush = () => {
  if (buffer.length === 0) return;
  console.log(buffer.join("\n"));
  buffer.length = 0;
};

/** @param {string} line */
const onMessage = (line) => buffer.push(line);

const job = setInterval(flush, interval);
parentPort.on("message", onMessage);
parentPort.on("close", () => {
  clearInterval(job);
  parentPort.off("message", onMessage);
  flush();
});
