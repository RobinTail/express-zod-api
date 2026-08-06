import { writeFile } from "node:fs/promises";
import { Integration } from "express-zod-api/integration";
import { routing } from "./routing.ts";
import { config } from "./config.ts";
import { format } from "oxfmt";

const oxFmt = async (code: string) => (await format("client.ts", code)).code;

await writeFile(
  "example.client.ts",
  await new Integration({
    routing,
    config,
    serverUrl: `http://localhost:${config.http!.listen}`,
    // or just .print()
  }).printFormatted({ format: oxFmt }),
  "utf-8",
);
