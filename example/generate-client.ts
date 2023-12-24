import { writeFile } from "node:fs/promises";
import { Integration } from "../src";
import { routing } from "./routing";

await writeFile(
  "example/example.client.ts",
  // or just: new Integration({ routing }).print(),
  await new Integration({ routing }).printFormatted(),
  "utf-8",
);
