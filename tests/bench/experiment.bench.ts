import { bench, describe } from "vitest";
import {
  SimplifiedWinstonConfig,
  isSimplifiedWinstonConfig,
} from "../../src/logger";

describe("Experiment", () => {
  const originalFn = (subject: unknown): subject is SimplifiedWinstonConfig =>
    typeof subject === "object" &&
    subject !== null &&
    "level" in subject &&
    ("color" in subject ? typeof subject.color === "boolean" : true) &&
    typeof subject.level === "string" &&
    ["silent", "warn", "debug"].includes(subject.level);

  bench("original", () => {
    originalFn({ level: "debug" });
  });

  bench("featured", () => {
    isSimplifiedWinstonConfig({ level: "debug" });
  });
});
