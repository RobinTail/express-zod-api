import { writeFileSync } from "node:fs";
import { givePort } from "./testing";
import { extractReadmeQuickStart } from "./extract-quick-start";

const quickStart = extractReadmeQuickStart().replaceAll(
  `${givePort("example")}`,
  `${givePort("esm")}`,
);

const dir = "../esm-test";
writeFileSync(`${dir}/quick-start.ts`, quickStart.trim());
