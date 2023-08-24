import { writeFileSync } from "node:fs";

/** @todo the CI should have another job for integration tests instead of all that */
const manifest = {
  type: "module",
  main: "index.mjs",
  types: "../../../../dist/index.d.mts",
};

writeFileSync(
  "./tests/esm/node_modules/express-zod-api/package.json",
  `${JSON.stringify(manifest)}\n`,
);
