import * as entrypoint from "./index";

describe("Index Entrypoint", () => {
  describe("exports", () => {
    const entities = Object.keys(entrypoint);

    test("should have certain entities exposed", () => {
      expect(entities).toMatchSnapshot();
    });

    test.each(entities)("%s should have certain value", (entry) => {
      const entity = entrypoint[entry as keyof typeof entrypoint];
      if (entity === undefined) {
        expect(entity).toBeUndefined();
      } else {
        expect(entity).toMatchSnapshot();
      }
    });
  });
});
