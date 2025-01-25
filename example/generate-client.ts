import { writeFile } from "node:fs/promises";
import { Integration } from "../src";
import { givePort } from "../tests/helpers";
import { routing } from "./routing";

await writeFile(
  "example/example.client.ts",
  // or just: new Integration({ routing }).print(),
  await new Integration({
    routing,
    serverUrl: `http://localhost:${givePort("example")}`,
  }).printFormatted(),
  "utf-8",
);
