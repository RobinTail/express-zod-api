import { write } from "node:fs";
import { clearInterval } from "node:timers";
import { parentPort, workerData } from "node:worker_threads";
import type { Message, WorkerData, Ack } from "./typescript-worker";

if (!parentPort)
  throw new Error("Logger worker must be run as a Worker Thread.");

const { interval, fd } = workerData as WorkerData;

const buffer: string[] = [];

const flush = () => {
  if (buffer.length === 0) return;
  write(fd, buffer.join("\n") + "\n", () => {}); // @todo error handling?
  buffer.length = 0;
};

const job = setInterval(flush, interval);

const onMessage = (msg: Message) => {
  if (msg.command === "log") return buffer.push(msg.line);
  if (msg.command === "close") {
    clearInterval(job);
    parentPort?.off("message", onMessage);
    flush();
    parentPort?.postMessage("done" satisfies Ack);
  }
};

parentPort.on("message", onMessage);
