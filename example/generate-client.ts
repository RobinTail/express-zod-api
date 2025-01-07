import { writeFile } from "node:fs/promises";
import { Integration } from "express-zod-api";
import { config } from "./config.ts";
import { routing } from "./routing.ts";

await writeFile(
  "example.client.ts",
  await new Integration({
    routing,
    serverUrl: `http://localhost:${config.http!.listen}`,
  }).printFormatted(), // or just .print(),
  "utf-8",
);
