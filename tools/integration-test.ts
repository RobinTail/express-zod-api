import fs from "fs";
import { esmTestPort } from "../tests/helpers";

const nodeVersion = process.versions.node.split(".").shift();
const tsconfigBase = nodeVersion === "15" ? "14" : nodeVersion;

const packageJson = `
{
  "name": "express-zod-api-integration-test",
  "version": "1.0.0",
  "scripts": {
    "start": "ts-node quick-start.ts"
  },
  "author": {
    "name": "Anna Bocharova",
    "url": "https://robintail.cz",
    "email": "me@robintail.cz"
  },
  "license": "MIT",
  "dependencies": {
    "@tsconfig/node${tsconfigBase}": "latest",
    "express-zod-api": "../../dist",
    "ts-node": "9.1.1",
    "typescript": "4.4.4"
  }
}
`;

const tsConfigJson = `
{
  "extends": "@tsconfig/node${tsconfigBase}/tsconfig.json",
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

const quickStart = tsParts
  .map((part) => part.split("\n").slice(1, -1).join("\n"))
  .join("\n\n");

const dir = "./tests/integration";
fs.writeFileSync(`${dir}/package.json`, packageJson.trim());
fs.writeFileSync(`${dir}/tsconfig.json`, tsConfigJson.trim());
fs.writeFileSync(`${dir}/quick-start.ts`, quickStart.trim());
