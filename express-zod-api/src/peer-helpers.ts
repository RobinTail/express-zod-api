import { createRequire } from "node:module";
import { MissingPeerError } from "./errors";

const require = createRequire(import.meta.url);

export const loadPeer = <T>(
  moduleName: string,
  moduleExport: string = "default",
): T => {
  try {
    const mod = require(moduleName);
    if (moduleExport !== "default") return mod[moduleExport] as T;
    return mod.default !== undefined ? mod.default : mod;
  } catch {
    throw new MissingPeerError(moduleName);
  }
};
