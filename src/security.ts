interface BasicSecurity {
  type: "basic";
}

interface BearerSecurity {
  type: "bearer";
  format?: "JWT" | string;
}

interface InputSecurity<K extends string> {
  type: "input";
  name: K;
}

interface CustomHeaderSecurity {
  type: "header";
  name: string;
}

interface CookieSecurity {
  type: "cookie";
  name: string;
}

/**
 * @see https://swagger.io/docs/specification/authentication/openid-connect-discovery/
 * @desc available scopes has to be provided via the specified URL
 */
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

/** @desc K is an optional input field used by InputSecurity */
export type Security<K extends string = string> =
  | BasicSecurity
  | BearerSecurity
  | InputSecurity<K>
  | CustomHeaderSecurity
  | CookieSecurity
  | OpenIdSecurity
  | OAuth2Security;
