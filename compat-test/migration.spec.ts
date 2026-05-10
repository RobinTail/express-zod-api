import { readFile } from "node:fs/promises";
import { describe, test, expect } from "vitest";

describe("Migration", () => {
  test("should migrate", async () => {
    const fixed = await readFile("./sample.ts", "utf-8");
    expect(fixed.split("\n")[0]).toBe(`createConfig({ hintAllowedMethods: false });`);
  });
});
