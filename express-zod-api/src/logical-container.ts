import * as R from "ramda";
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

type Combination<T> = T[];
/** @desc OR[ AND[a,b] , AND[b,c] ] */
export type Alternatives<T> = Array<Combination<T>>;

export const processContainers = <T>(
  containers: LogicalContainer<T>[],
): Alternatives<T> => {
  const simples = R.filter(isSimple, containers);
  const ands = R.chain(R.prop("and"), R.filter(isLogicalAnd, containers));
  const [simpleAnds, orsInAnds] = R.partition(isSimple, ands);
  const persistent: Combination<T> = R.concat(simples, simpleAnds);
  const ors = R.filter(isLogicalOr, containers);
  const alternators = R.map(R.prop("or"), R.concat(ors, orsInAnds)); // no chain!
  return alternators.reduce(
    (acc, entry) =>
      combinations(
        acc,
        R.map((opt) => (isSimple(opt) ? [opt] : opt.and), entry),
        ([a, b]) => R.concat(a, b),
      ),
    R.reject(R.isEmpty, [persistent]),
  );
};
