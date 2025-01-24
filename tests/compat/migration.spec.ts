import { readFile } from "node:fs/promises";

describe("Migration", () => {
  test("should fix the import", async () => {
    const fixed = await readFile("./sample.ts", "utf-8");
    expect(fixed).toBe(`client.provide("get /v1/test", {id: 10});\n`);
  });
});
