import { createServer } from "express-zod-api";
import { config } from "./config";
import { routing } from "./routing";

createServer(config, routing);
