import { z } from "zod";
import type { NormalizedResponse } from "../src/api-response";
import { contentTypes } from "../src/content-type";
import { mergeStatusCodes, type MergedResponse } from "../src/ranges";

const toCodes = (subject: readonly (NormalizedResponse | MergedResponse)[]) =>
  subject.flatMap(({ statusCodes }) => statusCodes as (string | number)[]);

const json = [contentTypes.json] satisfies NormalizedResponse["mimeTypes"];

describe("mergeStatusCodes()", () => {
  test("should return the responses untouched when nothing is collapsible", () => {
    const responses: NormalizedResponse[] = [
      { schema: z.literal("ok"), mimeTypes: json, statusCodes: [200] },
      { schema: z.literal("error"), mimeTypes: json, statusCodes: [400] },
    ];
    expect(mergeStatusCodes(responses)).toBe(responses);
    expect(toCodes(mergeStatusCodes(responses))).toEqual([200, 400]);
  });

  test("should collapse the codes of a single schema into a range", () => {
    const responses: NormalizedResponse[] = [
      {
        schema: z.literal("ok"),
        mimeTypes: json,
        statusCodes: [200, 201, 204],
      },
      { schema: z.literal("error"), mimeTypes: json, statusCodes: [400] },
    ];
    expect(toCodes(mergeStatusCodes(responses))).toEqual(["2XX", 400]);
  });

  test("should not create a range from duplicated status codes", () => {
    const responses: NormalizedResponse[] = [
      {
        schema: z.literal("ok"),
        mimeTypes: json,
        statusCodes: [200, 200],
      },
      { schema: z.literal("error"), mimeTypes: json, statusCodes: [400, 404] },
    ];
    expect(toCodes(mergeStatusCodes(responses))).toEqual([200, "4XX"]);
  });

  test("should collapse the codes of separate ApiResponse entries sharing the same schema", () => {
    const okSchema = z.object({ ok: z.boolean() });
    const responses: NormalizedResponse[] = [
      { schema: okSchema, mimeTypes: json, statusCodes: [200] },
      { schema: okSchema, mimeTypes: json, statusCodes: [201] },
      { schema: z.literal("error"), mimeTypes: json, statusCodes: [400] },
    ];
    expect(toCodes(mergeStatusCodes(responses))).toEqual(["2XX", 400]);
  });

  test("should merge positive and negative variants independently", () => {
    const responses: NormalizedResponse[] = [
      { schema: z.literal("ok"), mimeTypes: json, statusCodes: [200, 201] },
      {
        schema: z.literal("error"),
        mimeTypes: json,
        statusCodes: [400, 404],
      },
    ];
    expect(toCodes(mergeStatusCodes(responses))).toEqual(["2XX", "4XX"]);
  });

  test("should keep non-collapsible literal codes alongside the ranges", () => {
    const errA = z.object({ errA: z.boolean() });
    const errB = z.object({ errB: z.boolean() });
    const responses: NormalizedResponse[] = [
      { schema: z.literal("ok"), mimeTypes: json, statusCodes: [200, 201] },
      { schema: errA, mimeTypes: json, statusCodes: [400, 404] },
      { schema: errB, mimeTypes: json, statusCodes: [500] },
    ];
    expect(toCodes(mergeStatusCodes(responses))).toEqual(["2XX", "4XX", 500]);
  });

  test("should keep literal codes when the range is claimed by another schema", () => {
    const responses: NormalizedResponse[] = [
      { schema: z.literal("ok"), mimeTypes: json, statusCodes: [200] },
      { schema: z.literal("bad"), mimeTypes: json, statusCodes: [400, 401] },
      { schema: z.literal("forbidden"), mimeTypes: json, statusCodes: [403] },
    ];
    expect(toCodes(mergeStatusCodes(responses))).toEqual([200, 400, 401, 403]);
  });

  test("should keep literal codes spanning multiple ranges", () => {
    const responses: NormalizedResponse[] = [
      { schema: z.literal("ok"), mimeTypes: json, statusCodes: [200] },
      {
        schema: z.literal("error"),
        mimeTypes: json,
        statusCodes: [400, 500],
      },
    ];
    expect(toCodes(mergeStatusCodes(responses))).toEqual([200, 400, 500]);
  });

  test("should partially merge the codes spanning multiple ranges", () => {
    const responses: NormalizedResponse[] = [
      { schema: z.literal("ok"), mimeTypes: json, statusCodes: [200] },
      {
        schema: z.literal("error"),
        mimeTypes: json,
        statusCodes: [400, 401, 500],
      },
    ];
    expect(toCodes(mergeStatusCodes(responses))).toEqual([200, "4XX", 500]);
  });

  test("should not merge the codes sharing a schema but differing in MIME types", () => {
    const okSchema = z.literal("ok");
    const responses: NormalizedResponse[] = [
      { schema: okSchema, mimeTypes: json, statusCodes: [200] },
      { schema: okSchema, mimeTypes: null, statusCodes: [204] },
      { schema: z.literal("error"), mimeTypes: json, statusCodes: [400] },
    ];
    expect(toCodes(mergeStatusCodes(responses))).toEqual([200, 204, 400]);
  });

  test("should merge the codes sharing a schema and MIME types in a different order", () => {
    const okSchema = z.literal("ok");
    const responses: NormalizedResponse[] = [
      {
        schema: okSchema,
        mimeTypes: ["application/json", "text/plain"],
        statusCodes: [200],
      },
      {
        schema: okSchema,
        mimeTypes: ["text/plain", "application/json"],
        statusCodes: [204],
      },
      { schema: z.literal("error"), mimeTypes: json, statusCodes: [400] },
    ];
    expect(toCodes(mergeStatusCodes(responses))).toEqual(["2XX", 400]);
  });
});
