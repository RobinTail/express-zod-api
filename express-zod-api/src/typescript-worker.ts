import path from "node:path";
import { Worker } from "node:worker_threads";

/**
 * @see https://github.com/nodejs/node/issues/47747#issuecomment-2309062943
 * @link https://github.com/alshdavid/mach/blob/main/packages/mach_npm/platform/mach/worker.ts
 * @todo remove Typescript supported or loaders fixed for workers
 * */
export class TypescriptWorker extends Worker {
  public constructor(workerData: { interval: number }) {
    const filename = path.resolve(
      __dirname, // __dirname enabled by TSUP shims
      `worker.${process.env.TSUP_EXT || "ts"}`, // eslint-disable-line no-restricted-syntax -- replaced by TSUP
    );
    if (filename.endsWith(".ts")) {
      super(
        `import("tsx/esm/api").then(({ register }) => { register(); import("${filename}") })`,
        { eval: true, workerData },
      );
    } else {
      super(filename, { workerData });
    }
  }
}
