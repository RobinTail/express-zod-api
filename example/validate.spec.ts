import { readFile } from "node:fs/promises";

describe("OpenAPI schema validation", () => {
  test("should be valid", async () => {
    const data = await readFile("example.documentation.yaml", "utf-8");
    const response = await fetch(
      "https://validator.swagger.io/validator/debug",
      {
        method: "POST",
        headers: { "Content-Type": "application/yaml" },
        body: data,
      },
    );
    expect(response.status).toBe(200);
    const json = await response.json();
    if (
      typeof json === "object" &&
      json !== null &&
      "schemaValidationMessages" in json &&
      Array.isArray(json.schemaValidationMessages) &&
      json.schemaValidationMessages.length
    ) {
      console.debug(json);
      json.schemaValidationMessages.every(({ level }) =>
        expect(level).not.toBe("error"),
      );
    }
  });
});
