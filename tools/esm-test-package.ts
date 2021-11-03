import fs from "fs";

const manifest = {
  type: "module",
  types: "../../../../dist/index.d.ts",
};

fs.writeFileSync(
  "./tests/esm/node_modules/express-zod-api/package.json",
  `${JSON.stringify(manifest)}\n`
);
