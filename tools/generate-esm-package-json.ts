import fs from "fs";

const manifest = { type: "module" };

fs.writeFileSync("./dist-esm/package.json", `${JSON.stringify(manifest)}\n`);
