import { Worker, WorkerOptions } from "node:worker_threads";

/**
 * @see https://github.com/nodejs/node/issues/47747#issuecomment-2309062943
 * @link https://github.com/alshdavid/mach/blob/main/packages/mach_npm/platform/mach/worker.ts
 * @todo remove Typescript supported or loaders fixed for workers
 * */
export class TypescriptWorker extends Worker {
  public constructor(filename: string, options: WorkerOptions) {
    if (filename.endsWith(".ts")) {
      super(
        `import("tsx/esm/api").then(({ register }) => { register(); import("${filename}") })`,
        { ...options, eval: true },
      );
    } else {
      super(filename, options);
    }
  }
}
