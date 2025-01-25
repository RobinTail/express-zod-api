import {
  chain,
  isEmpty,
  map,
  partition,
  prop,
  reject,
  filter,
  concat,
} from "ramda";
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
export const processContainers = <T>(
  containers: LogicalContainer<T>[],
): T[][] => {
  const simples = filter(isSimple, containers);
  const ands = chain(prop("and"), filter(isLogicalAnd, containers));
  const [simpleAnds, orsInAnds] = partition(isSimple, ands);
  const persistent = concat(simples, simpleAnds);
  const ors = filter(isLogicalOr, containers);
  const alternators = map(prop("or"), concat(ors, orsInAnds)); // no chain!
  return alternators.reduce(
    (acc, entry) =>
      combinations(
        acc,
        map((opt) => (isSimple(opt) ? [opt] : opt.and), entry),
        ([a, b]) => concat(a, b),
      ),
    reject(isEmpty, [persistent]),
  );
};
