import { createServer } from "../src";
import { config } from "./config";
import { routing } from "./routing";

await createServer(config, routing);
