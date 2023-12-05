import { writeFileSync } from "node:fs";
import { extractReadmeQuickStart } from "./extract-quick-start";

const quickStart = extractReadmeQuickStart();

const dir = "./tests/integration";
writeFileSync(`${dir}/quick-start.ts`, quickStart.trim());
