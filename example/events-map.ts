import { CaseMap } from "../src/sockets";
import { onLog } from "./events/log";
import { onPing } from "./events/ping";

export const clientEvents: CaseMap = { ping: onPing, log: onLog };
