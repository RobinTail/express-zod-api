import { writeFileSync } from "node:fs";
import { extractReadmeQuickStart } from "./extract-quick-start";

const packageJson = `
{
  "name": "express-zod-api-integration-test",
  "version": "1.0.0",
  "scripts": {
    "postinstall": "cp dist.package.json node_modules/express-zod-api/package.json"
  },
  "dependencies": {
    "express-zod-api": "../../dist",
    "@swc/core": "^1.3.92",
    "@swc-node/register": "^1.6.8",
    "typescript": "^5.2.2",
    "@types/node": "*"
  }
}
`;

const quickStart = extractReadmeQuickStart();

/** @link https://github.com/RobinTail/express-zod-api/issues/952 */
const issue952 = quickStart.replace(/const/g, "export const");

const dir = "./tests/integration";
writeFileSync(`${dir}/package.json`, packageJson.trim());
writeFileSync(`${dir}/quick-start.ts`, quickStart.trim());
writeFileSync(`${dir}/issue952.ts`, issue952.trim());
