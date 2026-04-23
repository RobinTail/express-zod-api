import { bench, describe } from "vitest";
import * as R from "ramda";

const mergeableKeys = new Set([
  "type",
  "properties",
  "required",
  "examples",
  "description",
  "additionalProperties",
]);

const current = (subject: Record<string, unknown>) =>
  R.pipe(
    Object.keys,
    R.without([
      "type",
      "properties",
      "required",
      "examples",
      "description",
      "additionalProperties",
    ] as string[]),
    R.isEmpty,
  )(subject);

const featured = (subject: Record<string, unknown>): boolean => {
  for (const key of Object.keys(subject))
    if (!mergeableKeys.has(key)) return false;
  return true;
};

describe.each([
  {},
  { type: "object" },
  { type: "object", properties: {} },
  { type: "object", properties: {}, required: [] },
  { type: "object", properties: {}, required: [], examples: [] },
  {
    type: "object",
    properties: {},
    required: [],
    examples: [],
    description: "test",
  },
  {
    type: "object",
    properties: {},
    required: [],
    examples: [],
    description: "test",
    additionalProperties: false,
  },
  { type: "object", title: "test" },
  { type: "object", format: "date-time", title: "test" },
])("Experiment for canMerge %#", (subject) => {
  bench(`current`, () => {
    current(subject);
  });

  bench(`featured`, () => {
    featured(subject);
  });
});
