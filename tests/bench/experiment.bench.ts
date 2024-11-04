import { bench } from "vitest";

describe("Experiment for isServerSideIssue()", () => {
  const env = process.env.NODE_ENV;

  bench("access", () => {
    return void process.env.NODE_ENV;
  });

  bench("cached", () => {
    return void (env === "production");
  });
});
