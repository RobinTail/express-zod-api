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
      const tsxApiConst = "api";
      const dynamicImportFn = "import";
      const loader = f.createExpressionStatement(
        makeCall(
          makeCall(dynamicImportFn)(literally("tsx/esm/api")),
          propOf<Promise<typeof API>>("then"),
        )(
          makeArrowFn(
            [tsxApiConst],
            f.createBlock([
              f.createExpressionStatement(
                makeCall(tsxApiConst, propOf<typeof API>("register"))(),
              ),
              f.createExpressionStatement(
                makeCall(dynamicImportFn)(literally(filename)),
              ),
            ]),
          ),
        ),
      );
      super(printNode(loader), { eval: true, workerData });
    } else {
      super(filename, { workerData });
    }
  }
}
