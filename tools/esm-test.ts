import { writeFileSync } from "node:fs";
import { givePort } from "../tests/helpers";
import { extractReadmeQuickStart } from "./extract-quick-start";

const quickStart = extractReadmeQuickStart().replace(
  `${givePort("example")}`,
  `${givePort("esm")}`,
);

const dir = "./tests/esm";
writeFileSync(`${dir}/quick-start.ts`, quickStart.trim());
