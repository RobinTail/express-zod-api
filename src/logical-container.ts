import { chain } from "ramda";
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

/** @desc combines several LogicalAnds into a one */
const flattenAnds = <T>(subject: (T | LogicalAnd<T>)[]): LogicalAnd<T> => ({
  and: chain((item) => (isLogicalAnd(item) ? item.and : [item]), subject),
});

/** @desc creates a LogicalContainer out of another one */
export const mapLogicalContainer = <T, S>(
  container: LogicalContainer<T>,
  fn: (subject: T) => S,
): LogicalContainer<S> => {
  if (isLogicalAnd(container)) {
    return {
      and: container.and.map((entry) =>
        isLogicalOr(entry) ? { or: entry.or.map(fn) } : fn(entry),
      ),
    };
  }
  if (isLogicalOr(container)) {
    return {
      or: container.or.map((entry) =>
        isLogicalAnd(entry) ? { and: entry.and.map(fn) } : fn(entry),
      ),
    };
  }
  return fn(container);
};

/** @desc converts LogicalAnd into LogicalOr */
export const andToOr = <T>(
  subject: LogicalAnd<T | LogicalOr<T>>,
): LogicalOr<T | LogicalAnd<T>> =>
  subject.and.reduce<LogicalOr<T | LogicalAnd<T>>>(
    (acc, item) => ({
      or: combinations(
        acc.or,
        isLogicalOr(item) ? item.or : [item],
        flattenAnds,
      ),
    }),
    { or: [] },
  );

/** @desc reducer, combines two LogicalContainers */
export const combineContainers = <T>(
  left: LogicalContainer<T>,
  right: LogicalContainer<T>,
): LogicalContainer<T> => {
  if (isLogicalAnd(left)) {
    if (isLogicalOr(right)) return combineContainers(andToOr(left), right);
    return flattenAnds([left, right]);
  }

  if (isLogicalOr(left)) {
    if (isLogicalAnd(right)) return combineContainers(right, left);
    if (isLogicalOr(right))
      return { or: combinations(left.or, right.or, flattenAnds) };
    return combineContainers(left, { and: [right] });
  }

  if (isLogicalAnd(right) || isLogicalOr(right))
    return combineContainers(right, left);

  return { and: [left, right] };
};
