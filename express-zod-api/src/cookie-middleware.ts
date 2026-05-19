import { Middleware } from "./middleware";
import type { CookieOptions } from "express";

/**
 * @desc Creates a Middleware providing cookie-setting convenience methods.
 * @param baseOptions — Default options applied to every setCookie / clearCookie call.
 * @desc Per-call options are spread over base options, so you can override them individually.
 * @example createCookieMiddleware()
 * @example createCookieMiddleware({ httpOnly: true, secure: true, path: "/" })
 */
export const createCookieMiddleware = (baseOptions?: CookieOptions) =>
  new Middleware({
    handler: async ({ response }) => ({
      /** @desc Sets a cookie on the response. */
      setCookie: (name: string, value: string, options?: CookieOptions) => {
        response.cookie(name, value, { ...baseOptions, ...options });
      },
      /** @desc Clears a cookie on the response. */
      clearCookie: (name: string, options?: CookieOptions) => {
        response.clearCookie(name, { ...baseOptions, ...options });
      },
    }),
  });
