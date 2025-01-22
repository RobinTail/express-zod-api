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
  let ttt = [simples.flatMap(mapper)];
  const ands = containers.filter((entry) => isLogicalAnd(entry));
  const simpleAnds = ands.flatMap((entry) =>
    entry.and.filter(isSimple).map(mapper),
  );
  ttt[0].push(...simpleAnds);
  const orsInAnds = ands.flatMap((entry) =>
    entry.and
      .filter((entry) => isLogicalOr(entry))
      .map((entry) => entry.or.map((v) => [mapper(v)])),
  );
  for (const entry of orsInAnds) ttt = combinations(ttt, entry, joiner);
  const ors = containers.filter((entry) => isLogicalOr(entry));
  const simpleOrs = ors.map((entry) =>
    entry.or.map((v) => (isSimple(v) ? [mapper(v)] : v.and.flatMap(mapper))),
  );
  for (const entry of simpleOrs) ttt = combinations(ttt, entry, joiner);
  return ttt;
};
