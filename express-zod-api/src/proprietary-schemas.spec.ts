import { serializeSchema } from "../helpers/serializer";
import { raw } from "./proprietary-schemas";

describe("Proprietary schemas", () => {
  describe("ez.raw()", () => {
    test("Should an alias to ZodObject with raw:file", () => {
      expect(serializeSchema(raw())).toMatchSnapshot();
    });
  });
});
