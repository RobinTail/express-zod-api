import { Middleware } from "./middleware";
import type { CookieOptions } from "express";
import type { FlatObject } from "./common-helpers";

/**
 * @desc Creates a Middleware providing cookie-setting convenience methods.
 * @param baseOptions — Default options applied to every setCookie / clearCookie call.
 * @example createCookieMiddleware()
 * @example createCookieMiddleware({ httpOnly: true, secure: true, path: "/" })
 */
export const createCookieMiddleware = (baseOptions?: CookieOptions) =>
  new Middleware({
    handler: async ({ response }) => ({
      /** @desc Sets a cookie on the response. Express converts object values to JSON. */
      setCookie: (
        name: string,
        value: string | FlatObject,
        overrides?: CookieOptions,
      ) => {
        response.cookie(name, value, { ...baseOptions, ...overrides });
      },
      /** @desc Clears a cookie on the response. */
      clearCookie: (name: string, overrides?: CookieOptions) => {
        response.clearCookie(name, { ...baseOptions, ...overrides });
      },
    }),
  });
