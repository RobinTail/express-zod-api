import { writeFileSync } from "node:fs";

const manifest = {
  type: "module",
  main: "index.mjs",
  types: "../../../../dist/index.d.mts",
};

writeFileSync(
  "./node_modules/express-zod-api/package.json",
  `${JSON.stringify(manifest)}\n`,
);
