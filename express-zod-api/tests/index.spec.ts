import type { IRouter } from "express";
import { z } from "zod";
import * as entrypoint from "../src";
import type {
  ApiResponse,
  AppConfig,
  BasicSecurity,
  BearerSecurity,
  CommonConfig,
  CookieSecurity,
  FlatObject,
  HeaderSecurity,
  IOSchema,
  InputSecurity,
  LoggerOverrides,
  Method,
  OAuth2Security,
  OpenIdSecurity,
  Routing,
  ServerConfig,
} from "../src";

describe("Index Entrypoint", () => {
  describe("exports", () => {
    const entities = Object.keys(entrypoint);

    test("should have certain entities exposed", () => {
      expect(entities).toMatchSnapshot();
    });

    test.each(entities)("%s should have certain value", (entry) => {
      const entity = entrypoint[entry as keyof typeof entrypoint];
      if (entity !== undefined) expect(entity).toMatchSnapshot();
    });

    test("Issue 952, 1182, 1269: should expose certain types and interfaces", () => {
      expectTypeOf<"get">().toExtend<Method>();
      expectTypeOf(z.object({})).toExtend<IOSchema>();
      expectTypeOf({}).toExtend<FlatObject>();
      expectTypeOf({}).toEqualTypeOf<LoggerOverrides>();
      expectTypeOf({}).toExtend<Routing>();
      expectTypeOf<{
        cors: true;
        logger: { level: "silent" };
      }>().toExtend<CommonConfig>();
      expectTypeOf<{
        app: IRouter;
        cors: true;
        logger: { level: "silent" };
      }>().toExtend<AppConfig>();
      expectTypeOf<{
        http: { listen: 1234 };
        logger: { level: "silent" };
        cors: false;
      }>().toExtend<ServerConfig>();
      expectTypeOf<{ type: "basic" }>().toEqualTypeOf<BasicSecurity>();
      expectTypeOf<{
        type: "bearer";
        format?: string;
      }>().toEqualTypeOf<BearerSecurity>();
      expectTypeOf<{
        type: "cookie";
        name: string;
      }>().toEqualTypeOf<CookieSecurity>();
      expectTypeOf<{
        type: "header";
        name: string;
      }>().toEqualTypeOf<HeaderSecurity>();
      expectTypeOf<{ type: "input"; name: string }>().toEqualTypeOf<
        InputSecurity<string>
      >();
      expectTypeOf<{ type: "oauth2" }>().toExtend<OAuth2Security<string>>();
      expectTypeOf<{
        type: "openid";
        url: string;
      }>().toEqualTypeOf<OpenIdSecurity>();
      expectTypeOf({ schema: z.string() }).toExtend<ApiResponse<z.ZodString>>();
    });
  });
});
