import { createServer } from "express-zod-api";
import { config } from "./config.ts";
import { routing } from "./routing.ts";

createServer(config, routing);
