import { readFile } from "node:fs/promises";
import { describe, test, expect } from "vitest";

describe("Migration", () => {
  /** @todo update when migration rules populated */
  test("should fix the import", async () => {
    const fixed = await readFile("./sample.ts", "utf-8");
    expect(fixed).toBe("const sample = {};\n");
  });
});
