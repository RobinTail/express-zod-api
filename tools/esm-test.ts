import fs from "fs";
import { esmTestPort } from "../tests/helpers";
import { extractReadmeQuickStart } from "./extract-quick-start";
import { getTSConfigBase } from "./tsconfig-base";

const tsconfigBase = getTSConfigBase();

const packageJson = `
{
  "name": "express-zod-api-esm-test",
  "version": "1.0.0",
  "scripts": {
    "start": "ts-node-esm quick-start.ts"
  },
  "type": "module",
  "dependencies": {
    "@tsconfig/node${tsconfigBase}": "latest",
    "express-zod-api": "../../dist-esm",
    "ts-node": "10.7.0",
    "typescript": "4.6.2"
  }
}
`;

const tsConfigJson = `
{
  "extends": "@tsconfig/node${tsconfigBase}/tsconfig.json",
  "compilerOptions": {
    "module": "ES2015",
    "moduleResolution": "Node"
  }
}
`;

const readme = fs.readFileSync("README.md", "utf-8");
const quickStartSection = readme.match(/# Quick start(.+?)\n#\s[A-Z]+/s);

if (!quickStartSection) {
  throw new Error("Can not find Quick Start section");
}

const tsParts = quickStartSection[1].match(/```typescript(.+?)```/gis);

if (!tsParts) {
  throw new Error("Can not find typescript code samples");
}

const quickStart = extractReadmeQuickStart().replace(/8090/g, `${esmTestPort}`);

const dir = "./tests/esm";
fs.writeFileSync(`${dir}/package.json`, packageJson.trim());
fs.writeFileSync(`${dir}/tsconfig.json`, tsConfigJson.trim());
fs.writeFileSync(`${dir}/quick-start.ts`, quickStart.trim());
