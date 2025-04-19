import { IRouter } from "express";
import ts from "typescript";
import { z } from "zod";
import * as entrypoint from "../src";
import {
  ApiResponse,
  AppConfig,
  BasicSecurity,
  BearerSecurity,
  CommonConfig,
  CookieSecurity,
  HeaderSecurity,
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

    test("Convenience types should be exposed", () => {
      expectTypeOf(() => ({
        type: "number" as const,
      })).toExtend<Depicter>();
      expectTypeOf(() =>
        ts.factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
      ).toExtend<Producer>();
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
        http: { listen: 8090 };
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
      expectTypeOf({ schema: z.string() }).toExtend<
        ApiResponse<z.ZodTypeAny>
      >();
    });

    test("Extended Zod prototypes", () => {
      expectTypeOf<z.ZodAny>()
        .toHaveProperty("example")
        .toEqualTypeOf<(value: any) => z.ZodAny>();
      expectTypeOf<z.ZodDefault<z.ZodString>>()
        .toHaveProperty("example")
        .toEqualTypeOf<
          (value: string | undefined) => z.ZodDefault<z.ZodString>
        >();
      expectTypeOf<z.ZodDefault<z.ZodString>>()
        .toHaveProperty("label")
        .toEqualTypeOf<(value: string) => z.ZodDefault<z.ZodString>>();
      expectTypeOf<z.ZodObject>().toHaveProperty("remap");
    });
  });
});
