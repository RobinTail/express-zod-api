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
  const simples = containers.filter(isSimple);
  let ttt = [simples.flatMap(mapper)];
  const ands = containers.filter((entry) => isLogicalAnd(entry));
  ttt[0].push(
    ...ands.flatMap((entry) => entry.and.filter(isSimple).map(mapper)),
  );
  ttt = combinations(
    ttt,
    ands.map((entry) =>
      entry.and
        .filter((entry) => isLogicalOr(entry))
        .flatMap((entry) => entry.or.map(mapper)),
    ),
    ([a, b]) => a.concat(b),
  );
  const ors = containers.filter((entry) => isLogicalOr(entry));
  const simpleOrs = ors.flatMap((entry) =>
    entry.or.filter(isSimple).map((v) => [mapper(v)]),
  );
  ttt = combinations(ttt, simpleOrs, ([a, b]) => a.concat(b));
  ttt = combinations(
    ttt,
    ors.map((entry) =>
      entry.or
        .filter((entry) => isLogicalAnd(entry))
        .flatMap((entry) => entry.and.flatMap(mapper)),
    ),
    ([a, b]) => a.concat(b),
  );
  return ttt;
};
