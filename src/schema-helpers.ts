export const isValidDate = (date: Date): boolean => !isNaN(date.getTime());

/**
 * @example 2021-01-01T00:00:00.000Z
 * @example 2021-01-01T00:00:00.0Z
 * @example 2021-01-01T00:00:00Z
 * @example 2021-01-01T00:00:00
 * @example 2021-01-01
 */
export const isoDateRegex =
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?)?Z?$/;
