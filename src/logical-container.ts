import { chain, isEmpty, reject } from "ramda";
import { combinations, isObject } from "./common-helpers";

type LogicalOr<T> = { or: T[] };
type LogicalAnd<T> = { and: T[] };

export type LogicalContainer<T> =
  | LogicalOr<T | LogicalAnd<T>>
  | LogicalAnd<T | LogicalOr<T>>
  | T;

const isLogicalOr = (subject: unknown): subject is LogicalOr<unknown> =>
  isObject(subject) && "or" in subject;

const isLogicalAnd = (subject: unknown): subject is LogicalAnd<unknown> =>
  isObject(subject) && "and" in subject;

const isSimple = <T>(entry: LogicalContainer<T>): entry is T =>
  !isLogicalAnd(entry) && !isLogicalOr(entry);

/** @desc returns an array of alternatives: OR[ AND[a,b] , AND[b,c] ] */
export const processContainers = <T, U>(
  containers: LogicalContainer<T>[],
  mapper: (subject: T) => U,
): U[][] => {
  const joiner = ([a, b]: [U[], U[]]) => a.concat(b);
  const simples = containers.filter(isSimple);
  const ands = containers.filter((entry) => isLogicalAnd(entry));
  const ors = containers.filter((entry) => isLogicalOr(entry));
  let alts = [
    simples
      .map(mapper)
      .concat(chain((entry) => entry.and.filter(isSimple).map(mapper), ands)),
  ];
  const alternators = chain(
    (entry) =>
      entry.and
        .filter((entry) => isLogicalOr(entry))
        .map((entry) => entry.or.map((v) => [mapper(v)])),
    ands,
  ).concat(
    ors.map((entry) =>
      entry.or.map((v) => (isSimple(v) ? [mapper(v)] : v.and.map(mapper))),
    ),
  );
  for (const entry of alternators) alts = combinations(alts, entry, joiner);
  return reject(isEmpty, alts);
};
