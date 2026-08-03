import { describe, test, expect } from "vitest";
import { readFile } from "node:fs/promises";

describe("DTS", () => {
  test("Zod plugin must bundle augmentation into its DTS", async () => {
    const pluginDts = await readFile(
      "./node_modules/express-zod-api/node_modules/@express-zod-api/zod-plugin/dist/index.d.ts",
      "utf-8",
    );
    expect(pluginDts).toMatch(`declare module "zod"`);
  });
});
