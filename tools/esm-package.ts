import fs from "node:fs";
import path from "node:path";
const originalManifest = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "package.json"), "utf-8")
);

const manifest = {
  type: "module",
  version: originalManifest.version, // for yarn in esm test
};

fs.writeFileSync("./dist-esm/package.json", `${JSON.stringify(manifest)}\n`);
