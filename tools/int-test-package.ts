import fs from "fs";

const manifest = {
  types: "../../../../dist/index.d.ts",
};

fs.writeFileSync(
  "./tests/integration/node_modules/express-zod-api/package.json",
  `${JSON.stringify(manifest)}\n`
);
