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

interface AuthUrl {
  /**
   * @desc The authorization URL to use for this flow. Can be relative to the API server URL.
   * @see https://swagger.io/docs/specification/api-host-and-base-path/
   */
  authorizationUrl: string;
}

interface TokenUrl {
  /** @desc The token URL to use for this flow. Can be relative to the API server URL. */
  tokenUrl: string;
}

interface RefreshUrl {
  /** @desc The URL to be used for obtaining refresh tokens. Can be relative to the API server URL. */
  refreshUrl?: string;
}

interface Scopes<K extends string> {
  /** @desc The available scopes for the OAuth2 security and their short descriptions. Optional. */
  scopes?: Record<K, string>;
}

type AuthCodeFlow<S extends string> = AuthUrl &
  TokenUrl &
  RefreshUrl &
  Scopes<S>;

type ImplicitFlow<S extends string> = AuthUrl & RefreshUrl & Scopes<S>;
type PasswordFlow<S extends string> = TokenUrl & RefreshUrl & Scopes<S>;
type ClientCredFlow<S extends string> = TokenUrl & RefreshUrl & Scopes<S>;

/**
 * @see https://swagger.io/docs/specification/authentication/oauth2/
 */
interface OAuth2Security<S extends string> {
  type: "oauth2";
  flows?: {
    /** @desc Authorization Code flow (previously called accessCode in OpenAPI 2.0) */
    authorizationCode?: AuthCodeFlow<S>;
    /** @desc Implicit flow */
    implicit?: ImplicitFlow<S>;
    /** @desc Resource Owner Password flow */
    password?: PasswordFlow<S>;
    /** @desc Client Credentials flow (previously called application in OpenAPI 2.0) */
    clientCredentials?: ClientCredFlow<S>;
  };
}

/**
 * @desc K is an optional input field used by InputSecurity
 * @desc S is an optional union of scopes used by OAuth2Security
 * */
export type Security<K extends string = string, S extends string = string> =
  | BasicSecurity
  | BearerSecurity
  | InputSecurity<K>
  | CustomHeaderSecurity
  | CookieSecurity
  | OpenIdSecurity
  | OAuth2Security<S>;
