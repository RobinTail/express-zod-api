import { writeFile } from "node:fs/promises";
import { Integration } from "../src";
import { routing } from "./routing";
import { config } from "./config";

await writeFile(
  "example/example.client.ts",
  await new Integration({
    routing,
    serverUrl: `http://localhost:${config.http!.listen}`,
  }).printFormatted(), // or just .print(),
  "utf-8",
);
