import { Integration } from "express-zod-api";
import { routing } from "./routing";

describe("System test for Integration", () => {
  test.each(["client", "types"] as const)(
    "Should generate a %s for example API",
    (variant) => {
      const client = new Integration({ variant, routing });
      expect(client.print()).toMatchSnapshot();
    },
  );
});
