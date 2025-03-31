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

const job = setInterval(flush, interval);

/** @argument object */
const onMessage = ({ command, line }) => {
  if (command === "log") return buffer.push(line);
  if (command === "close") {
    clearInterval(job);
    parentPort.off("message", onMessage);
    flush();
    parentPort.postMessage("done");
  }
};

parentPort.on("message", onMessage);
