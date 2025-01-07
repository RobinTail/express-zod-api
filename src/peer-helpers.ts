import { MissingPeerError } from "./errors.ts";

export const loadPeer = async <T>(
  moduleName: string,
  moduleExport: string = "default",
): Promise<T> => {
  try {
    return (await import(moduleName))[moduleExport];
  } catch {}
  throw new MissingPeerError(moduleName);
};
