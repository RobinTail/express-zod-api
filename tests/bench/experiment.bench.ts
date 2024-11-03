import createHttpError from "http-errors";
import { bench } from "vitest";

describe("Experiment for isServerSideIssue()", () => {
  const error = createHttpError(501);

  bench("bitwise", () => {
    return void (~~(error.statusCode / 100) === 5);
  });

  bench("clamp", () => {
    return void (error.statusCode >= 500 && error.statusCode < 600);
  });
});
