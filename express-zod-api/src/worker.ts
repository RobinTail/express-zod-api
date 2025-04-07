import { write } from "node:fs";
import { clearInterval } from "node:timers";
import { parentPort, workerData } from "node:worker_threads";
import type { Message, WorkerData, Ack } from "./typescript-worker";

if (!parentPort)
  throw new Error("Logger worker must be run as a Worker Thread.");

const { interval, fd, maxBufferSize } = workerData as WorkerData;

const buffer: string[] = [];
let flushing = Promise.resolve();

const flush = () => {
  if (buffer.length === 0) return flushing;
  const output = buffer.join("\n") + "\n";
  buffer.length = 0;
  return (flushing = flushing.then(
    () =>
      new Promise<void>((resolve) => {
        write(fd, output, () => resolve()); // @todo error handling
      }),
  ));
};

const job = setInterval(flush, interval);

const onMessage = (msg: Message) => {
  if (msg.command === "log")
    return buffer.push(msg.line) === maxBufferSize && flush();
  clearInterval(job);
  parentPort?.off("message", onMessage);
  flush().then(() => parentPort?.postMessage("done" satisfies Ack));
};

parentPort.on("message", onMessage);
