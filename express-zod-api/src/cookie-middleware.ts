import { Middleware } from "./middleware";
import type { CookieOptions } from "express";

export const cookieMiddleware = new Middleware({
  handler: async ({ response }) => ({
    setCookie: (name: string, value: string, options?: CookieOptions) => {
      response.cookie(name, value, options ?? {});
    },
    clearCookie: (name: string, options?: CookieOptions) => {
      response.clearCookie(name, options ?? {});
    },
  }),
});
