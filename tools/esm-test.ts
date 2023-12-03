import { readFileSync, writeFileSync } from "node:fs";
import { givePort } from "../tests/helpers";
import { extractReadmeQuickStart } from "./extract-quick-start";

const readme = readFileSync("README.md", "utf-8");
const quickStartSection = readme.match(/# Quick start(.+?)\n#\s[A-Z]+/s);

if (!quickStartSection) {
  throw new Error("Can not find Quick Start section");
}

const tsParts = quickStartSection[1].match(/```typescript(.+?)```/gis);

if (!tsParts) {
  throw new Error("Can not find typescript code samples");
}

const quickStart = extractReadmeQuickStart().replace(
  /8090/g,
  `${givePort("esm")}`,
);

const dir = "./esm-test";
writeFileSync(`${dir}/quick-start.ts`, quickStart.trim());
