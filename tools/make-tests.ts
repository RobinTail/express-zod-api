import { extractReadmeQuickStart } from "./extract-quick-start";
import { writeFile } from "node:fs/promises";
import { givePort } from "../tests/helpers";

const quickStart = await extractReadmeQuickStart();

/** @link https://github.com/RobinTail/express-zod-api/issues/952 */
const issue952QuickStart = quickStart.replace(/const/g, "export const");

const esmQuickStart = quickStart.replace(
  `${givePort("example")}`,
  `${givePort("esm")}`,
);

await writeFile("./tests/cjs/quick-start.ts", quickStart);
await writeFile("./tests/issue952/quick-start.ts", issue952QuickStart);
await writeFile("./tests/esm/quick-start.ts", esmQuickStart);
