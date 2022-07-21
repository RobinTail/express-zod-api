import { Client } from "../src/index.js";
import { routing } from "./routing.js";

console.log(new Client(routing).print());
