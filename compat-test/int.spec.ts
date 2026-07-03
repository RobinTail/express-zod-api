import { Integration } from "express-zod-api";
import { describe, test, expect } from "vitest";

describe("Integration", () => {
  test("should work with minimum supported TypeScript",  () => {
    expect(
      new Integration({ config: { cors: false }, routing: {} }).print()
    ).toContain("export class Client");
  });
});
