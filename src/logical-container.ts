import { combinations } from "./common-helpers";

type LogicalOr<T> = { or: T[] };
type LogicalAnd<T> = { and: T[] };

export type LogicalContainer<T> =
  | LogicalOr<T | LogicalAnd<T>>
  | LogicalAnd<T | LogicalOr<T>>
  | T;

const isObject = (subject: unknown): subject is object =>
  typeof subject === "object" && subject !== null;

/** @desc combines several LogicalAnds into a one */
const flattenAnds = <T>(subject: (T | LogicalAnd<T>)[]): LogicalAnd<T> => ({
  and: subject.reduce<T[]>(
    (agg, item) =>
      agg.concat(isObject(item) && "and" in item ? item.and : item),
    [],
  ),
});

/** @desc creates a LogicalContainer out of another one */
export const mapLogicalContainer = <T, S>(
  container: LogicalContainer<T>,
  fn: (subject: T) => S,
): LogicalContainer<S> => {
  if (isObject(container)) {
    if ("and" in container) {
      return {
        and: container.and.map((entry) =>
          isObject(entry) && "or" in entry
            ? { or: entry.or.map(fn) }
            : fn(entry),
        ),
      };
    }
    if ("or" in container) {
      return {
        or: container.or.map((entry) =>
          isObject(entry) && "and" in entry
            ? { and: entry.and.map(fn) }
            : fn(entry),
        ),
      };
    }
  }
  return fn(container);
};

/** @desc converts LogicalAnd into LogicalOr */
export const andToOr = <T>(
  subject: LogicalAnd<T | LogicalOr<T>>,
): LogicalOr<T | LogicalAnd<T>> => {
  return subject.and.reduce<LogicalOr<T | LogicalAnd<T>>>(
    (acc, item) => {
      const combs = combinations(
        acc.or,
        isObject(item) && "or" in item ? item.or : [item],
      );
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
  if (isObject(a)) {
    if ("and" in a) {
      if (isObject(b)) {
        if ("and" in b) {
          return flattenAnds([a, b]);
        }
        if ("or" in b) {
          return combineContainers(andToOr(a), b);
        }
      }
      return flattenAnds([a, b]);
    }
    if ("or" in a) {
      if (isObject(b)) {
        if ("and" in b) {
          return combineContainers(b, a);
        }
        if ("or" in b) {
          const combs = combinations(a.or, b.or);
          return {
            or:
              combs.type === "single"
                ? combs.value
                : combs.value.map(flattenAnds),
          };
        }
      }
      return combineContainers(a, { and: [b] });
    }
  }

  if (isObject(b) && ("and" in b || "or" in b)) {
    return combineContainers(b, a);
  }

  return { and: [a, b] };
};
