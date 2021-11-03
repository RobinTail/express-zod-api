import fs from "fs";
import { esmTestPort } from "../tests/helpers";

const nodeVersion = process.versions.node.split(".").shift();
const tsconfigBase = nodeVersion === "15" ? "14" : nodeVersion;

const packageJson = `
{
  "name": "express-zod-api-esm-test",
  "version": "1.0.0",
  "scripts": {
    "start": "NODE_OPTIONS=\\"--loader ts-node/esm --es-module-specifier-resolution=node\\" node quick-start.ts"
  },
  "author": {
    "name": "Anna Bocharova",
    "url": "https://robintail.cz",
    "email": "me@robintail.cz"
  },
  "license": "MIT",
  "type": "module",
  "dependencies": {
    "@tsconfig/node${tsconfigBase}": "latest",
    "express-zod-api": "../../dist-esm",
    "ts-node": "10.4.0",
    "typescript": "4.4.4"
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

const quickStart = tsParts
  .map((part) => part.split("\n").slice(1, -1).join("\n"))
  .join("\n\n")
  .replace(/8090/g, `${esmTestPort}`);

const dir = "./tests/esm";
fs.writeFileSync(`${dir}/package.json`, packageJson.trim());
fs.writeFileSync(`${dir}/tsconfig.json`, tsConfigJson.trim());
fs.writeFileSync(`${dir}/quick-start.ts`, quickStart.trim());
