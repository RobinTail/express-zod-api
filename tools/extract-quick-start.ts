import { readFileSync } from "node:fs";

export const extractReadmeQuickStart = () => {
  const readme = readFileSync("../README.md", "utf-8");
  const quickStartSection = readme.match(/# Quick start(.+?)\n#\s[A-Z]+/s);

  if (!quickStartSection) {
    throw new Error("Can not find Quick Start section");
  }

  const tsParts = quickStartSection[1].match(/```typescript(.+?)```/gis);

  if (!tsParts) {
    throw new Error("Can not find typescript code samples");
  }

  return tsParts
    .map((part) => part.split("\n").slice(1, -1).join("\n"))
    .join("\n\n");
};
