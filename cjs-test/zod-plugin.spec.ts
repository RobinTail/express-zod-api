import "express-zod-api"; // side effect here via the Zod plugin
import { z } from "zod";

describe("Zod plugin in CJS environment", () => {
  /** @link https://github.com/RobinTail/express-zod-api/issues/2981 */
  test("Issue 2981: should patch Zod classes", () => {
    expect(typeof z.string().example).toBe("function");
    expect(z.string().example("test").meta()?.examples).toEqual(["test"]);
  });
});
