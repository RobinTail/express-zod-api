import * as entrypoint from "../../src";

describe("Index Entrypoint", () => {
  describe("exports", () => {
    const entities = Object.keys(entrypoint);

    test("should have certain entities exposed", () => {
      expect(entities).toMatchSnapshot();
    });

    test.each(entities)("%s should have certain value", async (entry) => {
      const imported = await import("../../src");
      const entity = imported[entry as keyof typeof imported];
      if (entity === undefined) {
        expect(entity).toBeUndefined();
      } else {
        expect(entity).toMatchSnapshot();
      }
    });
  });
});
