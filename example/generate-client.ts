import { writeFile } from "node:fs/promises";
import { Integration } from "express-zod-api";
import { routing } from "./routing.ts";
import { config } from "./config.ts";
import typescript from "typescript";

await writeFile(
  "example.client.ts",
  await new Integration({
    typescript,
    routing,
    config,
    serverUrl: `http://localhost:${config.http!.listen}`,
  }).printFormatted(), // or just .print(),
  "utf-8",
);
