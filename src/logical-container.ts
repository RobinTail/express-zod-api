export type LogicalContainer<T> =
  | {
      or: (T | LogicalContainer<T>)[];
    }
  | {
      and: (T | LogicalContainer<T>)[];
    }
  | T;

export const mapLogicalContainer = <T, S>(
  container: LogicalContainer<T>,
  fn: (subject: T) => S
): LogicalContainer<S> => {
  if ("and" in container) {
    return {
      and: container.and.map((entry) => mapLogicalContainer(entry, fn)),
    };
  }
  if ("or" in container) {
    return {
      or: container.or.map((entry) => mapLogicalContainer(entry, fn)),
    };
  }
  return fn(container);
};
