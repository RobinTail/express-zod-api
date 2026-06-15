import { createRequire } from "node:module";
import { MissingPeerError } from "./errors";

let require: NodeJS.Require;

export const loadPeer = <T>(
  moduleName: string,
  moduleExport: string = "default",
): T => {
  try {
    const mod = (require ??= createRequire(import.meta.url))(moduleName);
    if (moduleExport !== "default") return mod[moduleExport] as T;
    return mod.default !== undefined ? mod.default : mod;
  } catch {
    throw new MissingPeerError(moduleName);
  }
};
