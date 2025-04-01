import path from "node:path";
import { Worker } from "node:worker_threads";
import {
  f,
  literally,
  makeArrowFn,
  makeCall,
  printNode,
  propOf,
} from "./typescript-api";
import type * as API from "tsx/esm/api";

export interface WorkerData {
  /** @desc How often to print the logs */
  interval: number;
  /**
   * @desc this should be faster than console.log because it bypasses stream buffering
   * @example process.stdout.fd
   * */
  fd: number;
}

/**
 * @see https://github.com/nodejs/node/issues/47747#issuecomment-2309062943
 * @link https://github.com/alshdavid/mach/blob/main/packages/mach_npm/platform/mach/worker.ts
 * @todo remove when workers either support types stripping or import loaders
 * */
export class TypescriptWorker extends Worker {
  public constructor(workerData: WorkerData) {
    const filename = path.resolve(
      __dirname, // __dirname enabled by TSUP shims
      `worker.${process.env.TSUP_EXT || "ts"}`, // eslint-disable-line no-restricted-syntax -- replaced by TSUP
    );
    const tsxApiModule = "tsx/esm/api";
    const tsxApiConst = "api";
    const dynamicImportFn = "import";
    const loader =
      filename.endsWith(".ts") &&
      f.createExpressionStatement(
        makeCall(
          makeCall(dynamicImportFn)(literally(tsxApiModule)),
          propOf<Promise<typeof API>>("then"),
        )(
          makeArrowFn(
            [tsxApiConst],
            f.createBlock(
              [
                makeCall(tsxApiConst, propOf<typeof API>("register"))(),
                makeCall(dynamicImportFn)(literally(filename)),
              ].map(f.createExpressionStatement),
            ),
          ),
        ),
      );
    super(loader ? printNode(loader) : filename, {
      eval: !!loader,
      workerData,
    });
  }
}
