import * as entrypoint from "../src";
import type { Routing, LoggerOverrides, Method } from "../src";

describe("Index Entrypoint", () => {
  describe("exports", () => {
    const entities = Object.keys(entrypoint);

    test("should have certain entities exposed", () => {
      expect(entities).toMatchSnapshot();
    });

    test.each(entities)("%s should have certain value", (entry) => {
      const entity = entrypoint[entry as keyof typeof entrypoint];
      if (entity !== undefined) expect(entity).toMatchSnapshot();
    });

    test("should expose certain types and interfaces", () => {
      expectTypeOf<"get">().toExtend<Method>();
      expectTypeOf({}).toEqualTypeOf<LoggerOverrides>();
      expectTypeOf({}).toExtend<Routing>();
    });
  });
});
