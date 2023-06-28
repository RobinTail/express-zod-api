import * as entrypoint from "../../src";

describe("Index Entrypoint", () => {
  describe("exports", () => {
    const entities = Object.keys(entrypoint);
    let imported: typeof entrypoint;

    beforeAll(async () => {
      imported = await import("../../src/index.ts");
    });

    test("should have certain entities exposed", () => {
      expect(entities).toMatchSnapshot();
    });

    test.each(entities)("%s should have certain value", (entry) => {
      const entity = imported[entry as keyof typeof imported];
      if (entity === undefined) {
        expect(entity).toBeUndefined();
      } else {
        expect(entity).toMatchSnapshot();
      }
    });
  });
});
