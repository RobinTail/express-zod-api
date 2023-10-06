import { writeFileSync } from "node:fs";
import { Integration } from "../src";
import { routing } from "./routing";

writeFileSync(
  "example/example.client.ts",
  new Integration({ routing }).print(),
  "utf-8",
);
