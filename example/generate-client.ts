import { writeFile } from "node:fs/promises";
import { Integration } from "../src";
import { routing } from "./routing";

await writeFile(
  "example/example.client.ts",
  await new Integration({ routing }).print(),
  "utf-8",
);
