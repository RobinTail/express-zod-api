import { z } from "zod";
import { isSchema } from "./common-helpers";
import { contentTypes } from "./content-type";

export const defaultStatusCodes = {
  positive: 200,
  negative: 400,
} satisfies Record<string, number>;

export type ResponseVariant = keyof typeof defaultStatusCodes;
export const responseVariants = Object.keys(
  defaultStatusCodes,
) as ResponseVariant[];

/** @public this is the user facing configuration */
export class ApiResponse<S extends z.ZodType> {
  readonly #schema: S;
  readonly #statusCodes?: [number, ...number[]];
  readonly #mimeTypes?: [string, ...string[]] | null;

  public constructor(
    subject:
      | S // shorthand for { schema: S }, default status codes and MIME types applied
      | {
          schema: S;
          /** @default 200 for a positive and 400 for a negative response */
          statusCode?: number | [number, ...number[]];
          /**
           * @example null is for no content, such as 204 and 302
           * @default "application/json"
           * */
          mimeType?: string | [string, ...string[]] | null;
        },
  ) {
    const { schema, statusCode, mimeType } = isSchema(subject)
      ? { schema: subject }
      : subject;
    this.#schema = schema;
    this.#statusCodes =
      typeof statusCode === "number" ? [statusCode] : statusCode;
    this.#mimeTypes = typeof mimeType === "string" ? [mimeType] : mimeType;
  }

  public normalize(fbStatus: number) {
    return {
      schema: this.#schema,
      statusCodes: this.#statusCodes ?? [fbStatus],
      mimeTypes:
        this.#mimeTypes === undefined ? [contentTypes.json] : this.#mimeTypes,
    };
  }
}

export type NormalizedResponse = ReturnType<
  ApiResponse<z.ZodType>["normalize"]
>;
