import { combinations } from "./common-helpers";

type LogicalOr<T> = { or: T[] };
type LogicalAnd<T> = { and: T[] };

export type LogicalContainer<T> =
  | LogicalOr<T | LogicalAnd<T>>
  | LogicalAnd<T | LogicalOr<T>>
  | T;

export const mapLogicalContainer = <T, S>(
  container: LogicalContainer<T>,
  fn: (subject: T) => S
): LogicalContainer<S> => {
  if (typeof container === "object") {
    if ("and" in container) {
      return {
        and: container.and.map((entry) =>
          typeof entry === "object" && "or" in entry
            ? { or: entry.or.map(fn) }
            : fn(entry)
        ),
      };
    }
    if ("or" in container) {
      return {
        or: container.or.map((entry) =>
          typeof entry === "object" && "and" in entry
            ? { and: entry.and.map(fn) }
            : fn(entry)
        ),
      };
    }
  }
  return fn(container);
};

export const andToOr = <T>(
  subject: LogicalAnd<T | LogicalOr<T>>
): LogicalOr<T | LogicalAnd<T>> => {
  return subject.and.reduce<LogicalOr<T | LogicalAnd<T>>>(
    (acc, item) => {
      const combs = combinations(acc.or, "or" in item ? item.or : [item]);
      acc.or.concat(
        combs.type === "single"
          ? combs.value
          : [...combs.value[0], ...combs.value[1]]
      );
      return acc;
    },
    {
      or: [],
    }
  );
};

export const combineContainers = <T>(
  a: LogicalContainer<T>,
  b: LogicalContainer<T>
): LogicalContainer<T> => {
  if ("and" in a) {
    if ("and" in b) {
      return { and: a.and.concat(b.and) };
    }
    if ("or" in b) {
      return combineContainers(andToOr(a), b);
    }
  }
  if ("or" in a) {
    if ("and" in b) {
      return combineContainers(b, a);
    }
    if ("or" in b) {
      const combs = combinations(a.or, b.or);
      return {
        or:
          combs.type === "single"
            ? combs.value
            : [...combs.value[0], ...combs.value[1]],
      };
    }
  }
  return { and: [a as T, b as T] };
};
