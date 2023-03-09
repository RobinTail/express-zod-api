import manifest from "../package.json";
import fs from "fs";
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
    "@types/node": "*",
    "ts-node": "^10.9.1",
    "express-zod-api": "../../dist",
    "typescript": "${manifest.peerDependencies.typescript}",
    "zod": "${manifest.peerDependencies.zod}",
    "express": "${manifest.peerDependencies.express}"
  }
}
`;

const tsConfigJson = `
{
  "extends": "@tsconfig/node${tsconfigBase}/tsconfig.json",
}
`;

const quickStart = extractReadmeQuickStart();

const dir = "./tests/integration";
fs.writeFileSync(`${dir}/package.json`, packageJson.trim());
fs.writeFileSync(`${dir}/tsconfig.json`, tsConfigJson.trim());
fs.writeFileSync(`${dir}/quick-start.ts`, quickStart.trim());
