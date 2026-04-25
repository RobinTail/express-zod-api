import * as R from "ramda";
import { combinations, isObject } from "./common-helpers";
import type { Security } from "./security";

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

const pickHeaders = (container: LogicalContainer<Security>): string[] => {
  if (isSimple(container)) {
    return "type" in container && container.type === "header"
      ? [container.name]
      : [];
  }
  if (isLogicalAnd(container)) return R.chain(pickHeaders, container.and);
  if (isLogicalOr(container)) return R.chain(pickHeaders, container.or);
  return [];
};

/** @desc Extract header security names from logical containers without generating combinations */
export const pickSecurityHeaders = (
  containers: LogicalContainer<Security>[],
): Set<string> => new Set(R.chain(pickHeaders, containers));

export const processContainers = <T>(
  containers: LogicalContainer<T>[],
  maxCombinations = Infinity,
): Alternatives<T> => {
  if (!(maxCombinations > 0)) return [];
  const simples = R.filter(isSimple, containers);
  const ands = R.chain(R.prop("and"), R.filter(isLogicalAnd, containers));
  const [simpleAnds, orsInAnds] = R.partition(isSimple, ands);
  const persistent: Combination<T> = R.concat(simples, simpleAnds);
  const ors = R.filter(isLogicalOr, containers);
  const alternators = R.map(R.prop("or"), R.concat(ors, orsInAnds)); // no chain!
  return alternators.reduce(
    (acc, entry) =>
      combinations<Combination<T>>(
        acc,
        R.map((opt) => (isSimple(opt) ? [opt] : opt.and), entry),
        R.concat,
        maxCombinations,
      ),
    R.reject(R.isEmpty, [persistent]),
  );
};
