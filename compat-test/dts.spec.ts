import { describe, test, expect } from "vitest";
import { readFile } from "node:fs/promises";

describe("DTS", () => {
  test("Framework must import Zod plugin", async () => {
    const fwDts = await readFile(
      "./node_modules/express-zod-api/dist/index.d.ts",
      "utf-8",
    );
    expect(fwDts).toMatch(`import "@express-zod-api/zod-plugin";`);
  });

  test("Zod plugin must import augmentation", async () => {
    const pluginDts = await readFile(
      "./node_modules/express-zod-api/node_modules/@express-zod-api/zod-plugin/dist/index.d.ts",
      "utf-8",
    );
    expect(pluginDts).toMatch(`import './augmentation.js';`);
  });

  test("Augmentation must extend Zod", async () => {
    const augDts = await readFile(
      "./node_modules/express-zod-api/node_modules/@express-zod-api/zod-plugin/dist/augmentation.d.ts",
      "utf-8",
    );
    expect(augDts).toMatch(`declare module "zod"`);
  });
});
