import { extractReadmeQuickStart } from "./extract-quick-start";
import { writeFileSync } from "node:fs";
import { givePort } from "../tests/helpers";

const quickStart = extractReadmeQuickStart();

/** @link https://github.com/RobinTail/express-zod-api/issues/952 */
const issue952QuickStart = quickStart.replace(/const/g, "export const");

const esmQuickStart = quickStart.replace(
  `${givePort("example")}`,
  `${givePort("esm")}`,
);

writeFileSync("./tests/integration/quick-start.ts", quickStart);
writeFileSync("./tests/issue952/quick-start.ts", issue952QuickStart);
writeFileSync("./tests/esm/quick-start.ts", esmQuickStart);
