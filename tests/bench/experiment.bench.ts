import { chain } from "ramda";
import { bench } from "vitest";
import { ucFirst } from "../../src/common-helpers";

export const current = (...args: string[]) =>
  args
    .flatMap((entry) => entry.split(/[^A-Z0-9]/gi)) // split by non-alphanumeric characters
    .flatMap((entry) =>
      // split by sequences of capitalized letters
      entry.replaceAll(/[A-Z]+/g, (beginning) => `/${beginning}`).split("/"),
    )
    .map(ucFirst)
    .join("");

export const feat = (...args: string[]) => {
  const byAlpha = chain((entry) => entry.split(/[^A-Z0-9]/gi), args);
  const byWord = chain(
    (entry) =>
      entry.replaceAll(/[A-Z]+/g, (beginning) => `/${beginning}`).split("/"),
    byAlpha,
  );
  return byWord.map(ucFirst).join("");
};

describe("Experiment on flatMap", () => {
  const subj = ["v1", "test/jest", "something anything"];

  bench("current", () => {
    current(...subj);
  });

  bench("featured", () => {
    feat(...subj);
  });
});
