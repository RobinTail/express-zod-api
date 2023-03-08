import fs from "fs";
import * as original from "../dist/esm/package.json";

const manifest = {
  ...original,
  types: "../../../../dist/index.d.ts", // also add types for it
};

fs.writeFileSync(
  "./tests/esm/node_modules/express-zod-api/package.json",
  `${JSON.stringify(manifest)}\n`
);
