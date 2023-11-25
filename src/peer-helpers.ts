import { MissingPeerError } from "./errors";

export const loadPeer = async <T>(
  moduleName: string,
  moduleExport: string = "default",
): Promise<T> => {
  try {
    return (await import(moduleName))[moduleExport];
  } catch {}
  try {
    return await Promise.resolve().then(
      /**
       * alternative way for environments that do not support dynamic imports even it's CJS compatible
       * @example jest with ts-jest
       * @link https://github.com/evanw/esbuild/issues/2651
       */
      () => require(moduleName)[moduleExport],
    );
  } catch {}
  throw new MissingPeerError(moduleName);
};

export const loadAltPeer = async <T>(
  alternatives: { moduleName: string; moduleExport?: string }[],
  fallback?: { moduleName: string; provider: () => T },
) => {
  for (const { moduleName, moduleExport } of alternatives) {
    try {
      return await loadPeer<T>(moduleName, moduleExport);
    } catch {}
  }
  try {
    const result = fallback?.provider();
    if (result) {
      return result;
    }
  } catch {}
  throw new MissingPeerError(
    alternatives
      .concat(fallback ? [fallback] : [])
      .map(({ moduleName }) => moduleName),
  );
};
