import * as R from "ramda";
import { z } from "zod";
import type { NormalizedResponse } from "./api-response";

/** @internal A flat entry with a single response key: a literal code or a wildcard range label. */
export interface MergedResponse {
  schema: z.ZodType;
  mimeTypes: NormalizedResponse["mimeTypes"];
  statusCodes: [string | number];
}

const statusCodeRange = (statusCode: number): `${number}XX` =>
  `${Math.floor(statusCode / 100)}XX`;

/** @internal Responses grouped by their schema and MIME types. */
interface ResponseBucket {
  schema: z.ZodType;
  mimeTypes: NormalizedResponse["mimeTypes"];
  statusCodes: number[];
}

const collectBuckets = (
  responses: readonly NormalizedResponse[],
): ResponseBucket[] => {
  const bySchema = new Map<z.ZodType, Map<string, ResponseBucket>>();
  for (const { schema, mimeTypes, statusCodes } of responses) {
    const signature = mimeTypes ? [...mimeTypes].sort().join(",") : "";
    const byMimeTypes =
      bySchema.get(schema) || new Map<string, ResponseBucket>();
    bySchema.set(schema, byMimeTypes);
    const previous = byMimeTypes.get(signature);
    byMimeTypes.set(signature, {
      schema,
      mimeTypes,
      statusCodes: previous
        ? [...previous.statusCodes, ...statusCodes]
        : [...statusCodes],
    });
  }
  const buckets: ResponseBucket[] = [];
  for (const byMimeTypes of bySchema.values())
    for (const bucket of byMimeTypes.values()) buckets.push(bucket);
  return buckets;
};

/** @internal Collapses one bucket into single-key entries, keeping the non-collapsible codes literal. */
const processBucket = (
  { schema, mimeTypes, statusCodes }: ResponseBucket,
  allCodes: readonly number[],
): MergedResponse[] => {
  const result: MergedResponse[] = [];
  const byRange = new Map<string, number[]>();
  for (const statusCode of statusCodes) {
    const range = statusCodeRange(statusCode);
    byRange.set(range, [...(byRange.get(range) || []), statusCode]);
  }
  for (const [range, codes] of byRange) {
    const foreignInRange = allCodes.some(
      (one) => statusCodeRange(one) === range && !codes.includes(one),
    );
    if (codes.length > 1 && !foreignInRange) {
      result.push({ schema, mimeTypes, statusCodes: [range] });
    } else {
      for (const statusCode of codes)
        result.push({ schema, mimeTypes, statusCodes: [statusCode] });
    }
  }
  return result;
};

/**
 * @desc Collapses several status codes sharing the same schema and MIME types into wildcard
 * range keys (2XX, 3XX, 4XX, 5XX).
 * @desc Returns the original responses untouched when nothing has been collapsed.
 * */
export const mergeStatusCodes = (
  responses: readonly NormalizedResponse[],
): readonly NormalizedResponse[] | MergedResponse[] => {
  const allCodes = R.chain(R.prop("statusCodes"), responses);
  const merged = R.chain(
    (bucket) => processBucket(bucket, allCodes),
    collectBuckets(responses),
  );
  return merged.some(({ statusCodes }) => typeof statusCodes[0] === "string")
    ? merged
    : responses;
};
