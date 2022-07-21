import fs from "node:fs";
import path from "node:path";
import esmConfig from "../tsconfig.esm.json";

const files = fs
  .readdirSync(esmConfig.compilerOptions.outDir)
  .filter((filename) => /.js$/.test(filename));

for (const file of files) {
  const content = fs.readFileSync(
    path.join(esmConfig.compilerOptions.outDir, file),
    "utf8"
  );
  const output = content.replace(
    /from ".\/(.+?)"/gis,
    (found) => `${found.slice(0, -1)}.js"`
  );
  fs.writeFileSync(path.join(esmConfig.compilerOptions.outDir, file), output);
}
