import { parentPort } from "node:worker_threads";

if (!parentPort)
  throw new Error("Logger worker must be run as a Worker Thread.");

parentPort.on("message", (line: string) => {
  console.log(line);
});
