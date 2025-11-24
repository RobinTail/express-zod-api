import { z } from "zod";
import { createRequire } from "node:module";

export const getZodPackages = () => {
  const packages = [z];
  const { z: zCJS } = createRequire(import.meta.url)("zod") as { z: typeof z };
  if (z !== zCJS) packages.push(zCJS);
  return packages;
};
