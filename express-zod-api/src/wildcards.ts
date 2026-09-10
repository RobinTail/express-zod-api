import * as R from "ramda";
import { z } from "zod";
import type { NormalizedResponse } from "./api-response";

export type Wildcard = `${number}XX`;

/** @internal Similar to NormalizedResponse but with a single item in the statusCodes that can be a wildcard */
export interface MergedResponse extends Omit<
  NormalizedResponse,
  "statusCodes"
> {
  statusCodes: [Wildcard | number];
}

const makeWildcard = (statusCode: number): Wildcard =>
  `${Math.floor(statusCode / 100)}XX`;

/** @internal Responses grouped by their schema and MIME types. */
interface Bucket extends Omit<NormalizedResponse, "statusCodes"> {
  statusCodes: Set<number>; // for deduplication
}

const collectBuckets = (responses: readonly NormalizedResponse[]): Bucket[] => {
  const bySchema = new Map<z.ZodType, Map<string, Bucket>>();
  for (const { schema, mimeTypes, statusCodes } of responses) {
    const mimeKey = mimeTypes ? [...mimeTypes].sort().join(",") : "";
    const byMime = bySchema.get(schema) || new Map<string, Bucket>();
    bySchema.set(schema, byMime); // @todo consider .getOrInsertComputed() when min Node is 26
    const prev = byMime.get(mimeKey);
    const codeSet = new Set(statusCodes);
    byMime.set(mimeKey, {
      schema,
      mimeTypes,
      statusCodes: prev ? codeSet.union(prev.statusCodes) : codeSet,
    });
  }
  const buckets: Bucket[] = [];
  for (const byMimeTypes of bySchema.values())
    for (const bucket of byMimeTypes.values()) buckets.push(bucket);
  return buckets;
};

/** @internal Collapses one bucket into single-key entries, keeping the non-collapsible codes literal. */
const processBucket = (
  { schema, mimeTypes, statusCodes }: Bucket,
  allCodes: readonly number[],
): MergedResponse[] => {
  const result: MergedResponse[] = [];
  const byRange = new Map<Wildcard, Set<number>>();
  for (const code of statusCodes) {
    const range = makeWildcard(code);
    const prev = byRange.get(range);
    byRange.set(range, prev ? new Set([code]).union(prev) : new Set([code]));
  }
  for (const [range, codes] of byRange) {
    const hasForeign = allCodes.some(
      (one) => makeWildcard(one) === range && !codes.has(one),
    );
    if (codes.size > 1 && !hasForeign) {
      result.push({ schema, mimeTypes, statusCodes: [range] });
    } else {
      for (const statusCode of codes)
        result.push({ schema, mimeTypes, statusCodes: [statusCode] });
    }
  }
  return result;
};

const hasWildcard = ({ statusCodes }: MergedResponse) =>
  typeof statusCodes[0] === "string";

/**
 * @desc Collapses several status codes sharing the same schema and MIME types into wildcard ranges (2XX, 4XX).
 * @returns The original responses untouched when nothing has been collapsed.
 * */
export const mergeStatusCodes = (
  responses: readonly NormalizedResponse[],
): readonly NormalizedResponse[] | MergedResponse[] => {
  const allCodes = R.chain(R.prop("statusCodes"), responses);
  const merged = R.chain(
    (bucket) => processBucket(bucket, allCodes),
    collectBuckets(responses),
  );
  return merged.some(hasWildcard) ? merged : responses;
};
