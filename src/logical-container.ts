import { chain, isEmpty, partition, prop, reject } from "ramda";
import { combinations, isObject } from "./common-helpers";

type LogicalOr<T> = { or: T[] };
type LogicalAnd<T> = { and: T[] };

export type LogicalContainer<T> =
  | LogicalOr<T | LogicalAnd<T>>
  | LogicalAnd<T | LogicalOr<T>>
  | T;

const isLogicalOr = <T>(subject: LogicalContainer<T>) =>
  isObject(subject) && "or" in subject;

const isLogicalAnd = <T>(subject: LogicalContainer<T>) =>
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
  const ands = chain(prop("and"), containers.filter(isLogicalAnd));
  const [simpleAnds, orsInAnds] = partition(isSimple, ands);
  const ors = containers.filter(isLogicalOr);
  let alts = [simples.concat(simpleAnds).map(mapper)];
  const alternators = orsInAnds
    .map((entry) => entry.or.map((v) => [mapper(v)]))
    .concat(
      ors.map((entry) =>
        entry.or.map((v) => (isSimple(v) ? [mapper(v)] : v.and.map(mapper))),
      ),
    );
  for (const entry of alternators) alts = combinations(alts, entry, joiner);
  return reject(isEmpty, alts);
};
