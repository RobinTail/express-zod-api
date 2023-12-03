import { writeFileSync } from "node:fs";
import { Integration } from "express-zod-api";
import { routing } from "./routing";

writeFileSync(
  "example/example.client.ts",
  new Integration({ routing }).print(),
  "utf-8",
);
