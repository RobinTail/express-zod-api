import fs from "fs";
import originalManifest from "../package.json";

const manifest = {
  type: "module",
  version: originalManifest.version, // for yarn in esm test
};

fs.writeFileSync("./dist-esm/package.json", `${JSON.stringify(manifest)}\n`);
