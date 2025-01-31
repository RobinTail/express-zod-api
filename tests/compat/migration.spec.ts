import { readFile } from "node:fs/promises";

describe("Migration", () => {
  test("should fix the import", async () => {
    const fixed = await readFile("./sample.ts", "utf-8");
    expect(fixed).toBe(`placeholder\n`);
  });
});
