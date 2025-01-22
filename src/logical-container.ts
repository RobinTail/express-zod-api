import { isObject } from "./common-helpers";

type LogicalOr<T> = { or: T[] };
type LogicalAnd<T> = { and: T[] };

export type LogicalContainer<T> =
  | LogicalOr<T | LogicalAnd<T>>
  | LogicalAnd<T | LogicalOr<T>>
  | T;

export const isLogicalOr = (subject: unknown): subject is LogicalOr<unknown> =>
  isObject(subject) && "or" in subject;

export const isLogicalAnd = (
  subject: unknown,
): subject is LogicalAnd<unknown> => isObject(subject) && "and" in subject;
