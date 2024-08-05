import { readFile } from "node:fs/promises";
import { reject, startsWith, partition, path, flip } from "ramda";

const excludeTypes = reject(startsWith("@types/"));

/** @todo make it a plugin later */
export const getDependencies = async (packageJson, unlistedPeers) => {
  const manifest = JSON.parse(await readFile(packageJson, "utf-8"));
  const lookup = flip(path)(manifest);
  const isOptional = (name) =>
    lookup(["peerDependenciesMeta", name, "optional"]);

  const allPeers = excludeTypes(Object.keys(manifest.peerDependencies));
  const [optPeers, reqPeers] = partition(isOptional, allPeers);
  const production = Object.keys(manifest.dependencies);

  return {
    allowed: production.concat(reqPeers),
    typeOnly: optPeers.concat(unlistedPeers),
  };
};
