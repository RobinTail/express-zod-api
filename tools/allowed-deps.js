import { readFile } from "node:fs/promises";
import { reject, startsWith, partition, path, flip } from "ramda";

// @todo consider "import with" starting Node 18.20 and 20.10
const manifest = JSON.parse(await readFile("./package.json", "utf-8"));

const unlistedPeers = ["eslint", "prettier"];
const excludeTypes = reject(startsWith("@types/"));
const lookup = flip(path)(manifest);
const allPeers = excludeTypes(Object.keys(manifest.peerDependencies));
const isOptional = (name) => lookup(["peerDependenciesMeta", name, "optional"]);
const [optPeers, reqPeers] = partition(isOptional, allPeers);
const production = Object.keys(manifest.dependencies);
export const allowed = production.concat(reqPeers);
export const typeOnly = optPeers.concat(unlistedPeers);

console.debug("Allowed imports", allowed);
console.debug("Type only imports", typeOnly);
