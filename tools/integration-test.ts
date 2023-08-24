import { writeFileSync } from "node:fs";
import { extractReadmeQuickStart } from "./extract-quick-start";
import { getTSConfigBase } from "./tsconfig-base";

const tsconfigBase = getTSConfigBase();

const packageJson = `
{
  "name": "express-zod-api-integration-test",
  "version": "1.0.0",
  "scripts": {
    "start": "ts-node quick-start.ts"
  },
  "dependencies": {
    "@tsconfig/node${tsconfigBase}": "latest",
    "express-zod-api": "../../dist",
    "ts-node": "10.9.1",
    "typescript": "5.1.5",
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
