import { Client } from "../src/client";
import { routing } from "./routing";

console.log(new Client(routing).agg.join("\n"));
