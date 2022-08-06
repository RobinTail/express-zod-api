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
      const combs = combinations(
        acc.or,
        typeof item === "object" && "or" in item ? item.or : [item]
      );
      if (combs.type === "single") {
        acc.or.push(...combs.value);
      } else {
        // @todo extract and rename
        acc.or = combs.value.map((ttt) => ({
          and: ttt.reduce<T[]>(
            (agg, mmm) =>
              agg.concat(
                typeof mmm === "object" && "and" in mmm ? mmm.and : mmm
              ),
            []
          ),
        }));
      }
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
  if (typeof a === "object" && typeof b === "object") {
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
              : // @todo extract and rename
                combs.value.map((ttt) => ({
                  and: ttt.reduce<T[]>(
                    (agg, mmm) =>
                      agg.concat(
                        typeof mmm === "object" && "and" in mmm ? mmm.and : mmm
                      ),
                    []
                  ),
                })),
        };
      }
    }
  }
  return { and: [a as T, b as T] };
};
