import { readFile } from "node:fs/promises";

/** @todo update the pretest and assertion with actual code for v21 */
describe("Migration", () => {
  test("should fix the import", async () => {
    const fixed = await readFile("./sample.ts", "utf-8");
    expect(fixed).toMatch(/express-zod-api/);
  });
});
