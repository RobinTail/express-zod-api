import { Integration } from "express-zod-api";
import { describe, test, expect } from "vitest";

describe("Integration", () => {
  test("should work with minimum supported TypeScript", async () => {
    expect(
      (
        await Integration.create({ config: { cors: false }, routing: {} })
      ).print()
    ).toContain("export class Client");
  });
});