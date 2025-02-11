import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";

const extractQuickStartFromReadme = async () => {
  const readme = await readFile("README.md", "utf-8");
  const quickStartSection = readme.match(/# Quick start(.+?)\n#\s[A-Z]+/s);
  assert(quickStartSection, "Can not find Quick Start section");
  const tsParts = quickStartSection[1].match(/```typescript(.+?)```/gis);
  assert(tsParts, "Can not find typescript code samples");
  return tsParts
    .map((part) => part.split("\n").slice(1, -1).join("\n"))
    .join("\n\n")
    .trim();
};

const quickStart = await extractQuickStartFromReadme();

const testContent = {
  cjs: quickStart,
  esm: quickStart,
  issue952: quickStart.replace(/const/g, "export const"),
};

for (const testName in testContent) {
  await writeFile(
    `./${testName}-test/quick-start.ts`,
    testContent[testName as keyof typeof testContent],
  );
}
