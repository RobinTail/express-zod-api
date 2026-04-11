import { globalRegistry, z } from "zod";
import { brandProperty, getBrand } from "../src/brand";

describe("getBrand", () => {
  test.each([{ [brandProperty]: "test" }, {}, undefined])(
    "should take it from metadata in globalRegistry %#",
    (metadata) => {
      const subject = z.string();
      if (metadata) globalRegistry.add(subject, metadata);
      expect(getBrand(subject)).toBe(metadata?.[brandProperty]);
    },
  );
});
