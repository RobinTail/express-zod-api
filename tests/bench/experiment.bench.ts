import { chain, map, pipe, join } from "ramda";
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

export const feat = (...args: string[]) =>
  pipe(
    chain((entry: string) => entry.split(/[^A-Z0-9]/gi)),
    chain((entry) =>
      entry.replaceAll(/[A-Z]+/g, (beginning) => `/${beginning}`).split("/"),
    ),
    map(ucFirst),
    join(""),
  )(args);

describe("Experiment on flatMap", () => {
  const subj = ["v1", "test/jest", "something anything"];

  bench("current", () => {
    current(...subj);
  });

  bench("featured", () => {
    feat(...subj);
  });
});
