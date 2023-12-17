import { writeFile } from "node:fs/promises";
import { createIntegration } from "../src";
import { routing } from "./routing";

await writeFile(
  "example/example.client.ts",
  await createIntegration({ routing }).print(),
  "utf-8",
);
