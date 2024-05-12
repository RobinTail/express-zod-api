import { MissingPeerError } from "./errors";

export const loadPeer = async <T>(
  moduleName: string,
  moduleExport: string = "default",
): Promise<T> => {
  try {
    return (await import(moduleName))[moduleExport];
  } catch {}
  throw new MissingPeerError(moduleName);
};

export const loadAlternativePeer = async <T>(
  options: {
    moduleName: string;
    moduleExport?: string;
  }[],
) => {
  for (const { moduleName, moduleExport } of options) {
    try {
      return await loadPeer<T>(moduleName, moduleExport);
    } catch {}
  }
  throw new MissingPeerError(options.map(({ moduleName }) => moduleName));
};
