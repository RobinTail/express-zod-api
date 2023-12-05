import { writeFileSync } from "node:fs";
import { extractReadmeQuickStart } from "./extract-quick-start";

const quickStart = extractReadmeQuickStart();

/** @link https://github.com/RobinTail/express-zod-api/issues/952 */
const issue952 = quickStart.replace(/const/g, "export const");

const dir = "./tests/issue952";
writeFileSync(`${dir}/quick-start.ts`, issue952.trim());
