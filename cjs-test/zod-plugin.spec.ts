import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

require("express-zod-api"); // side effect here via Zod Plugin
const z = require("zod"); // ensure CJS version of Zod is used

describe("Zod plugin in CJS environment", () => {
  /** @link https://github.com/RobinTail/express-zod-api/issues/2981 */
  test("Issue 2981: should patch Zod classes", () => {
    expect(typeof z.string().example).toBe("function");
    expect(z.string().example("test").meta()?.examples).toEqual(["test"]);
  });
});
