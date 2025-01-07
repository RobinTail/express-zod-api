import { IRouter } from "express";
import ts from "typescript";
import { z } from "zod";
import * as entrypoint from "../src/index.ts";
import {
  ApiResponse,
  AppConfig,
  BasicSecurity,
  BearerSecurity,
  CommonConfig,
  CookieSecurity,
  CustomHeaderSecurity,
  Depicter,
  FlatObject,
  IOSchema,
  InputSecurity,
  LoggerOverrides,
  Method,
  OAuth2Security,
  OpenIdSecurity,
  Producer,
  Routing,
  ServerConfig,
} from "../src/index.ts";

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

    test("Convenience types should be exposed", () => {
      expectTypeOf(() => ({
        type: "number" as const,
      })).toMatchTypeOf<Depicter>();
      expectTypeOf(() =>
        ts.factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
      ).toMatchTypeOf<Producer>();
    });

    test("Issue 952, 1182, 1269: should expose certain types and interfaces", () => {
      expectTypeOf<"get">().toMatchTypeOf<Method>();
      expectTypeOf(z.object({})).toMatchTypeOf<IOSchema>();
      expectTypeOf({}).toMatchTypeOf<FlatObject>();
      expectTypeOf({}).toEqualTypeOf<LoggerOverrides>();
      expectTypeOf({}).toMatchTypeOf<Routing>();
      expectTypeOf<{
        cors: true;
        logger: { level: "silent" };
      }>().toMatchTypeOf<CommonConfig>();
      expectTypeOf<{
        app: IRouter;
        cors: true;
        logger: { level: "silent" };
      }>().toMatchTypeOf<AppConfig>();
      expectTypeOf<{
        http: { listen: 8090 };
        logger: { level: "silent" };
        cors: false;
      }>().toMatchTypeOf<ServerConfig>();
      expectTypeOf<{ type: "basic" }>().toMatchTypeOf<BasicSecurity>();
      expectTypeOf<{ type: "bearer" }>().toMatchTypeOf<BearerSecurity>();
      expectTypeOf<{
        type: "cookie";
        name: "some";
      }>().toMatchTypeOf<CookieSecurity>();
      expectTypeOf<{
        type: "header";
        name: "some";
      }>().toMatchTypeOf<CustomHeaderSecurity>();
      expectTypeOf<{ type: "input"; name: "some" }>().toMatchTypeOf<
        InputSecurity<string>
      >();
      expectTypeOf<{ type: "oauth2" }>().toMatchTypeOf<
        OAuth2Security<string>
      >();
      expectTypeOf<{
        type: "openid";
        url: "https://";
      }>().toMatchTypeOf<OpenIdSecurity>();
      expectTypeOf({ schema: z.string() }).toMatchTypeOf<
        ApiResponse<z.ZodTypeAny>
      >();
    });

    test("Extended Zod prototypes", () => {
      expectTypeOf({
        example: () => z.any(),
      }).toMatchTypeOf<Partial<z.ZodAny>>();
      expectTypeOf({
        example: () => z.string().default(""),
        label: () => z.string().default(""),
      }).toMatchTypeOf<Partial<z.ZodDefault<z.ZodString>>>();
      expectTypeOf({
        remap: () =>
          z.pipeline(
            z.object({}).transform(() => ({})),
            z.object({}),
          ),
      }).toMatchTypeOf<Partial<z.ZodObject<z.ZodRawShape, "strip">>>();
    });
  });
});
