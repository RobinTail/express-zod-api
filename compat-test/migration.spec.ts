import { readFile } from "node:fs/promises";
import { describe, test, expect } from "vitest";

describe("Migration", () => {
  test("should fix the import", async () => {
    const fixed = await readFile("./sample.ts", "utf-8");
    expect(fixed).toBe(`const route = {\nget: someEndpoint,\n}\n`);
  });
});
