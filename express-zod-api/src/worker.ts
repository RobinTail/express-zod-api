import { write } from "node:fs";
import { clearInterval } from "node:timers";
import { parentPort, workerData } from "node:worker_threads";

if (!parentPort)
  throw new Error("Logger worker must be run as a Worker Thread.");

const { interval = 100, fd } = { ...workerData };

const buffer: string[] = [];

const flush = () => {
  if (buffer.length === 0) return;
  write(fd, buffer.join("\n") + "\n", () => {}); // @todo error handling?
  buffer.length = 0;
};

const job = setInterval(flush, interval);

const onMessage = ({
  command,
  line,
}: {
  command: "log" | "close";
  line?: string;
}) => {
  if (command === "log" && line) return buffer.push(line);
  if (command === "close") {
    clearInterval(job);
    parentPort?.off("message", onMessage);
    flush();
    parentPort?.postMessage("done");
  }
};

parentPort.on("message", onMessage);
