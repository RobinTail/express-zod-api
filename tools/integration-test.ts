import { writeFileSync } from "node:fs";
import { extractReadmeQuickStart } from "./extract-quick-start";
import { getTSConfigBase } from "./tsconfig-base";

const tsconfigBase = getTSConfigBase();

const packageJson = `
{
  "name": "express-zod-api-integration-test",
  "version": "1.0.0",
  "scripts": {
    "tsnode": "node -r @swc-node/register",
    "postinstall": "yarn tsnode fix-package.ts",
    "start": "yarn tsnode quick-start.ts"
  },
  "dependencies": {
    "@tsconfig/node${tsconfigBase}": "latest",
    "express-zod-api": "../../dist",
    "@swc/core": "1.3.92",
    "@swc-node/register": "1.6.8",
    "typescript": "5.2.2",
    "@types/node": "*"
  }
}
`;

const tsConfigJson = `
{
  "extends": "@tsconfig/node${tsconfigBase}/tsconfig.json"
}
`;

const quickStart = extractReadmeQuickStart();

const dir = "./tests/integration";
writeFileSync(`${dir}/package.json`, packageJson.trim());
writeFileSync(`${dir}/tsconfig.json`, tsConfigJson.trim());
writeFileSync(`${dir}/quick-start.ts`, quickStart.trim());
