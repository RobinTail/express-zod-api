import { readFileSync, writeFileSync } from "node:fs";
import { givePort } from "../tests/helpers";
import { extractReadmeQuickStart } from "./extract-quick-start";
import { getTSConfigBase } from "./tsconfig-base";

const tsconfigBase = getTSConfigBase();

const packageJson = `
{
  "name": "express-zod-api-esm-test",
  "version": "1.0.0",
  "scripts": {
    "postinstall": "cp dist.package.json node_modules/express-zod-api/package.json"
  },
  "type": "module",
  "dependencies": {
    "@tsconfig/node${tsconfigBase}": "latest",
    "express-zod-api": "../../dist",
    "@swc/core": "^1.3.92",
    "@swc-node/register": "^1.6.8",
    "typescript": "^5.2.2",
    "@types/node": "*"
  }
}
`;

const tsConfigJson = `
{
  "extends": "@tsconfig/node${tsconfigBase}/tsconfig.json",
  "compilerOptions": {
    "module": "ES2022",
    "moduleResolution": "Bundler"
  }
}
`;

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

const dir = "./tests/esm";
writeFileSync(`${dir}/package.json`, packageJson.trim());
writeFileSync(`${dir}/tsconfig.json`, tsConfigJson.trim());
writeFileSync(`${dir}/quick-start.ts`, quickStart.trim());
