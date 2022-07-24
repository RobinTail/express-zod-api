interface BasicSecurity {
  type: "basic";
}

interface BearerSecurity {
  type: "bearer";
  format?: "JWT" | string;
}

interface CustomHeaderSecurity {
  type: "header";
  name: string;
}

interface CookieSecurity {
  type: "cookie";
  name: string;
}

interface OpenIdSecurity {
  type: "openid";
  url: string;
}

/**
 * @todo add more fields here
 * @see https://swagger.io/docs/specification/authentication/oauth2/
 */
interface OAuth2Security {
  type: "oauth2";
}

export type Security =
  | BasicSecurity
  | BearerSecurity
  | CustomHeaderSecurity
  | CookieSecurity
  | OpenIdSecurity
  | OAuth2Security;
