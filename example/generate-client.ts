import { writeFile } from "node:fs/promises";
import { Integration } from "express-zod-api";
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
