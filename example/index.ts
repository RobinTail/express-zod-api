import { createServer } from "../src/index.js";
import { config } from "./config.js";
import { routing } from "./routing.js";

createServer(config, routing);
