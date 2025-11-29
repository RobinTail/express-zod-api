import { z } from "zod";
import { createRequire } from "node:module";

export const getPackages = () => {
  const packages = [z];
  const { z: zCJS } = createRequire(import.meta.url)("zod") as { z: typeof z };
  if (z !== zCJS) packages.push(zCJS);
  return packages;
};

export const getClasses = (pkg: typeof z) =>
  Object.keys(pkg)
    .filter(
      (key) => key.startsWith("Zod") && !/(Success|Error|Function)$/.test(key),
    )
    .map((key) => pkg[key as keyof typeof pkg])
    .filter((Cls) => typeof Cls === "function");
