import { IRouter } from "express";
import { expectType } from "tsd";
import ts from "typescript";
import { z } from "zod";
import * as entrypoint from "../../src";
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
  MiddlewareDefinition,
  MockOverrides,
  OAuth2Security,
  OpenIdSecurity,
  Producer,
  ResultHandlerDefinition,
  Routing,
  ServerConfig,
} from "../../src";
import { describe, expect, test, vi } from "vitest";

describe("Index Entrypoint", () => {
  describe("exports", () => {
    const entities = Object.keys(entrypoint);

    test("should have certain entities exposed", () => {
      expect(entities).toMatchSnapshot();
    });

    test.each(entities)("%s should have certain value", (entry) => {
      const entity = entrypoint[entry as keyof typeof entrypoint];
      if (entity === undefined) {
        expect(entity).toBeUndefined();
      } else {
        expect(entity).toMatchSnapshot();
      }
    });

    test("Convenience types should be exposed", () => {
      expectType<Depicter>(() => ({ type: "number" }));
      expectType<Producer>(() =>
        ts.factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
      );
    });

    test("Issue 952, 1182, 1269: should expose certain types and interfaces", () => {
      expectType<MockOverrides>(vi.fn());
      expectType<Method>("get");
      expectType<IOSchema>(z.object({}));
      expectType<FlatObject>({});
      expectType<LoggerOverrides>({});
      expectType<Routing>({});
      expectType<CommonConfig>({ cors: true, logger: { level: "silent" } });
      expectType<AppConfig>({
        app: {} as IRouter,
        cors: true,
        logger: { level: "silent" },
      });
      expectType<ServerConfig>({
        server: { listen: 8090 },
        logger: { level: "silent" },
        cors: false,
      });
      expectType<MiddlewareDefinition<IOSchema<"strip">, {}, {}, string>>({
        type: "proprietary",
        input: z.object({}),
        middleware: vi.fn(),
      });
      expectType<ResultHandlerDefinition<z.ZodTypeAny, z.ZodTypeAny>>({
        getPositiveResponse: vi.fn(),
        getNegativeResponse: vi.fn(),
        handler: vi.fn(),
      });
      expectType<
        ResultHandlerDefinition<
          ApiResponse<z.ZodTypeAny>[],
          ApiResponse<z.ZodTypeAny>[]
        >
      >({
        getPositiveResponse: vi.fn(),
        getNegativeResponse: vi.fn(),
        handler: vi.fn(),
      });
      expectType<
        ResultHandlerDefinition<
          ApiResponse<z.ZodTypeAny>,
          ApiResponse<z.ZodTypeAny>
        >
      >({
        getPositiveResponse: vi.fn(),
        getNegativeResponse: vi.fn(),
        handler: vi.fn(),
      });
      expectType<BasicSecurity>({ type: "basic" });
      expectType<BearerSecurity>({ type: "bearer" });
      expectType<CookieSecurity>({ type: "cookie", name: "" });
      expectType<CustomHeaderSecurity>({ type: "header", name: "" });
      expectType<InputSecurity<string>>({ type: "input", name: "" });
      expectType<OAuth2Security<string>>({ type: "oauth2" });
      expectType<OpenIdSecurity>({ type: "openid", url: "" });
      expectType<ApiResponse<z.ZodTypeAny>>({ schema: z.string() });
    });

    test("Extended Zod prototypes", () => {
      expectType<Partial<z.ZodAny>>({
        example: () => z.any(),
      });
      expectType<Partial<z.ZodDefault<z.ZodString>>>({
        example: () => z.string().default(""),
        label: () => z.string().default(""),
      });
    });
  });
});
