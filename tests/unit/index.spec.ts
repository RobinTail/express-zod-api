import { IRouter } from "express";
import { expectType } from "tsd";
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
  FlatObject,
  IOSchema,
  InputSecurity,
  LoggerOverrides,
  Metadata,
  Method,
  MiddlewareDefinition,
  MockOverrides,
  OAuth2Security,
  OpenIdSecurity,
  ProprietaryMethods,
  ResultHandlerDefinition,
  Routing,
  ServerConfig,
  withMeta,
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

    test("Issue 952, 1182, 1269: should expose certain types and interfaces", () => {
      expectType<MockOverrides>(vi.fn());
      expectType<Method>("get");
      expectType<IOSchema>(z.object({}));
      expectType<FlatObject>({});
      expectType<LoggerOverrides>({});
      expectType<Routing>({});
      expectType<Metadata<z.ZodTypeAny>>({ examples: [] });
      expectType<ProprietaryMethods<z.ZodAny>>({
        example: () => withMeta(z.any()),
      });
      expectType<ProprietaryMethods<z.ZodDefault<z.ZodString>>>({
        example: () => withMeta(z.string().default("")),
        label: () => withMeta(z.string().default("")),
      });
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
  });
});
