import { Middleware } from "./middleware";
import type { CookieOptions } from "express";

/** @desc Middleware providing cookie-setting convenience methods. */
export const cookieMiddleware = new Middleware({
  handler: async ({ response }) => ({
    /** @desc Sets a cookie on the response. */
    setCookie: (name: string, value: string, options?: CookieOptions) => {
      response.cookie(name, value, options ?? {});
    },
    /** @desc Clears a cookie on the response. */
    clearCookie: (name: string, options?: CookieOptions) => {
      response.clearCookie(name, options ?? {});
    },
  }),
});
