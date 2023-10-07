import { combinations } from "./common-helpers";

type LogicalOr<T> = { or: T[] };
type LogicalAnd<T> = { and: T[] };

export type LogicalContainer<T> =
  | LogicalOr<T | LogicalAnd<T>>
  | LogicalAnd<T | LogicalOr<T>>
  | T;

const isObject = (subject: unknown): subject is object =>
  typeof subject === "object" && subject !== null;

const isLogicalOr = (subject: unknown): subject is LogicalOr<unknown> =>
  isObject(subject) && "or" in subject;

const isLogicalAnd = (subject: unknown): subject is LogicalAnd<unknown> =>
  isObject(subject) && "and" in subject;

/** @desc combines several LogicalAnds into a one */
const flattenAnds = <T>(subject: (T | LogicalAnd<T>)[]): LogicalAnd<T> => ({
  and: subject.reduce<T[]>(
    (agg, item) => agg.concat(isLogicalAnd(item) ? item.and : item),
    [],
  ),
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
): LogicalOr<T | LogicalAnd<T>> => {
  return subject.and.reduce<LogicalOr<T | LogicalAnd<T>>>(
    (acc, item) => {
      const combs = combinations(acc.or, isLogicalOr(item) ? item.or : [item]);
      if (combs.type === "single") {
        acc.or.push(...combs.value);
      } else {
        acc.or = combs.value.map(flattenAnds);
      }
      return acc;
    },
    {
      or: [],
    },
  );
};

/** @desc reducer, combines two LogicalContainers */
export const combineContainers = <T>(
  a: LogicalContainer<T>,
  b: LogicalContainer<T>,
): LogicalContainer<T> => {
  if (isLogicalAnd(a)) {
    if (isLogicalAnd(b)) {
      return flattenAnds([a, b]);
    }
    if (isLogicalOr(b)) {
      return combineContainers(andToOr(a), b);
    }
    return flattenAnds([a, b]);
  }

  if (isLogicalOr(a)) {
    if (isLogicalAnd(b)) {
      return combineContainers(b, a);
    }
    if (isLogicalOr(b)) {
      const { type, value } = combinations(a.or, b.or);
      return { or: type === "single" ? value : value.map(flattenAnds) };
    }
    return combineContainers(a, { and: [b] });
  }

  if (isLogicalAnd(b) || isLogicalOr(b)) {
    return combineContainers(b, a);
  }

  return { and: [a, b] };
};
