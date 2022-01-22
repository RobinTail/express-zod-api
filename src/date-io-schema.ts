import { ZodDate, ZodString } from "zod";

type RawCreateParams = Parameters<typeof ZodString.create>[0];
type DateInCreateParams = RawCreateParams & {
  invalidDateFormatErrorMessage?: string; // default is "Invalid date format"
  invalidDateErrorMessage?: string; // default is "Invalid date"
};
type DateOutCreateParams = RawCreateParams & {
  transformer?: (date: Date) => string; // default is .toISOString()
};

export const dateIn = (params: DateInCreateParams) =>
  ZodString.create(params)
    // simple regex for ISO date, supports the following formats:
    // 2021-01-01T00:00:00.000Z
    // 2021-01-01T00:00:00Z
    // 2021-01-01T00:00:00
    // 2021-01-01
    .regex(
      /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?)?Z?$/,
      params.invalidDateFormatErrorMessage || "Invalid date format"
    )
    // transforming the incoming string to a Date
    .transform((str) => new Date(str))
    // checking that the date is valid
    .refine(
      (date) => !isNaN(date.getTime()),
      params.invalidDateErrorMessage || "Invalid date"
    );

export const dateOut = (params: DateOutCreateParams) =>
  ZodDate.create(params).transform(
    params.transformer || ((date) => date.toISOString())
  );
