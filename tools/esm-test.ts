import { writeFileSync } from "node:fs";
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

const quickStart = extractReadmeQuickStart().replace(
  `${givePort("example")}`,
  `${givePort("esm")}`,
);

const dir = "./tests/esm";
writeFileSync(`${dir}/package.json`, packageJson.trim());
writeFileSync(`${dir}/tsconfig.json`, tsConfigJson.trim());
writeFileSync(`${dir}/quick-start.ts`, quickStart.trim());
