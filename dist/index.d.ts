import * as zod from 'zod';
import { z } from 'zod';
import compression from 'compression';
import * as express from 'express';
import express__default, { Request, Response, NextFunction, RequestHandler, IRouter } from 'express';
import * as express_fileupload from 'express-fileupload';
import express_fileupload__default from 'express-fileupload';
import https, { ServerOptions } from 'node:https';
import { Ansis } from 'ansis';
import { ListenOptions } from 'node:net';
import * as qs from 'qs';
import * as express_serve_static_core from 'express-serve-static-core';
import http from 'node:http';
import { SchemaObject, ReferenceObject, OpenApiBuilder, SecuritySchemeType, SecuritySchemeObject } from 'openapi3-ts/oas31';
import * as node_mocks_http from 'node-mocks-http';
import { RequestOptions, ResponseOptions } from 'node-mocks-http';
import ts from 'typescript';

declare const severity: {
    debug: number;
    info: number;
    warn: number;
    error: number;
};
type Severity = keyof typeof severity;
/** @desc You can use any logger compatible with this type. */
type AbstractLogger = Record<Severity, (message: string, meta?: any) => any>;
/**
 * @desc Using module augmentation approach you can set the type of the actual logger used
 * @example declare module "express-zod-api" { interface LoggerOverrides extends winston.Logger {} }
 * @link https://www.typescriptlang.org/docs/handbook/declaration-merging.html#module-augmentation
 * */
interface LoggerOverrides {
}
type ActualLogger = AbstractLogger & LoggerOverrides;

interface Context extends FlatObject {
    requestId?: string;
}
interface BuiltinLoggerConfig {
    /**
     * @desc The minimal severity to log or "silent" to disable logging
     * @example "debug" also enables pretty output for inspected entities
     * */
    level: "silent" | "warn" | "info" | "debug";
    /**
     * @desc Enables colors on printed severity and inspected entities
     * @default Ansis::isSupported()
     * */
    color?: boolean;
    /**
     * @desc Control how deeply entities should be inspected
     * @default 2
     * @example null
     * @example Infinity
     * */
    depth?: number | null;
    /**
     * @desc Context: the metadata applicable for each logged entry, used by .child() method
     * @see childLoggerProvider
     * */
    ctx?: Context;
}
interface ProfilerOptions {
    message: string;
    /** @default "debug" */
    severity?: Severity | ((ms: number) => Severity);
    /** @default formatDuration - adaptive units and limited fraction */
    formatter?: (ms: number) => string | number;
}
/** @desc Built-in console logger with optional colorful inspections */
declare class BuiltinLogger implements AbstractLogger {
    protected config: BuiltinLoggerConfig;
    protected hasColor: boolean;
    protected readonly styles: Record<Severity, Ansis>;
    /** @example new BuiltinLogger({ level: "debug", color: true, depth: 4 }) */
    constructor(config: BuiltinLoggerConfig);
    protected prettyPrint(subject: unknown): string;
    protected print(method: Severity, message: string, meta?: unknown): void;
    debug(message: string, meta?: unknown): void;
    info(message: string, meta?: unknown): void;
    warn(message: string, meta?: unknown): void;
    error(message: string, meta?: unknown): void;
    child(ctx: Context): BuiltinLogger;
    /** @desc Measures the duration until you invoke the returned callback */
    profile(message: string): () => void;
    profile(options: ProfilerOptions): () => void;
}

declare const defaultStatusCodes: {
    positive: number;
    negative: number;
};
type ResponseVariant = keyof typeof defaultStatusCodes;
interface ApiResponse<S extends z.ZodTypeAny> {
    schema: S;
    /**
     * @default 200 for a positive response
     * @default 400 for a negative response
     * @override statusCodes
     * */
    statusCode?: number;
    /**
     * @default [200] for positive response
     * @default [400] for negative response
     * */
    statusCodes?: [number, ...number[]];
    /**
     * @default "application/json"
     * @override mimeTypes
     * */
    mimeType?: string;
    /** @default [ "application/json" ] */
    mimeTypes?: [string, ...string[]];
}
type NormalizedResponse = Required<Pick<ApiResponse<z.ZodTypeAny>, "schema" | "statusCodes" | "mimeTypes">>;

type LogicalOr<T> = {
    or: T[];
};
type LogicalAnd<T> = {
    and: T[];
};
type LogicalContainer<T> = LogicalOr<T | LogicalAnd<T>> | LogicalAnd<T | LogicalOr<T>> | T;

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
type AuthCodeFlow<S extends string> = AuthUrl & TokenUrl & RefreshUrl & Scopes<S>;
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
 * @desc Middleware security schema descriptor
 * @param K is an optional input field used by InputSecurity
 * @param S is an optional union of scopes used by OAuth2Security
 * */
type Security<K extends string = string, S extends string = string> = BasicSecurity | BearerSecurity | InputSecurity<K> | CustomHeaderSecurity | CookieSecurity | OpenIdSecurity | OAuth2Security<S>;

type Handler$2<IN, OPT, OUT> = (params: {
    input: IN;
    options: OPT;
    request: Request;
    response: Response;
    logger: ActualLogger;
}) => Promise<OUT>;
declare abstract class AbstractMiddleware {
    abstract getSecurity(): LogicalContainer<Security> | undefined;
    abstract getSchema(): IOSchema<"strip">;
    abstract execute(params: {
        input: unknown;
        options: FlatObject;
        request: Request;
        response: Response;
        logger: ActualLogger;
    }): Promise<FlatObject>;
}
declare class Middleware<IN extends IOSchema<"strip">, OPT extends FlatObject, OUT extends FlatObject, SCO extends string> extends AbstractMiddleware {
    #private;
    constructor({ input, security, handler, }: {
        input: IN;
        security?: LogicalContainer<Security<Extract<keyof z.input<IN>, string>, SCO>>;
        handler: Handler$2<z.output<IN>, OPT, OUT>;
    });
    getSecurity(): LogicalContainer<Security<Extract<keyof z.input<IN>, string>, SCO>> | undefined;
    getSchema(): IN;
    /** @throws InputValidationError */
    execute({ input, ...rest }: {
        input: unknown;
        options: OPT;
        request: Request;
        response: Response;
        logger: ActualLogger;
    }): Promise<OUT>;
}
declare class ExpressMiddleware<R extends Request, S extends Response, OUT extends FlatObject> extends Middleware<z.ZodObject<EmptyObject, "strip">, FlatObject, OUT, string> {
    constructor(nativeMw: (request: R, response: S, next: NextFunction) => void | Promise<void>, { provider, transformer, }?: {
        provider?: (request: R, response: S) => OUT | Promise<OUT>;
        transformer?: (err: Error) => Error;
    });
}

/** Shorthand for z.object({ raw: ez.file("buffer") }) */
declare const raw: <S extends z.ZodRawShape>(extra?: S) => z.ZodBranded<z.ZodObject<z.objectUtil.extendShape<{
    raw: z.ZodBranded<z.ZodType<Buffer, z.ZodTypeDef, Buffer>, symbol>;
}, S>, "strip", z.ZodTypeAny, z.objectUtil.addQuestionMarks<z.baseObjectOutputType<z.objectUtil.extendShape<{
    raw: z.ZodBranded<z.ZodType<Buffer, z.ZodTypeDef, Buffer>, symbol>;
}, S>>, any> extends infer T ? { [k in keyof T]: z.objectUtil.addQuestionMarks<z.baseObjectOutputType<z.objectUtil.extendShape<{
    raw: z.ZodBranded<z.ZodType<Buffer, z.ZodTypeDef, Buffer>, symbol>;
}, S>>, any>[k]; } : never, z.baseObjectInputType<z.objectUtil.extendShape<{
    raw: z.ZodBranded<z.ZodType<Buffer, z.ZodTypeDef, Buffer>, symbol>;
}, S>> extends infer T_1 ? { [k_1 in keyof T_1]: z.baseObjectInputType<z.objectUtil.extendShape<{
    raw: z.ZodBranded<z.ZodType<Buffer, z.ZodTypeDef, Buffer>, symbol>;
}, S>>[k_1]; } : never>, symbol>;
type RawSchema = ReturnType<typeof raw>;

type BaseObject<U extends z.UnknownKeysParam> = z.ZodObject<z.ZodRawShape, U>;
interface ObjectBasedEffect<T extends z.ZodTypeAny> extends z.ZodEffects<T, FlatObject> {
}
type EffectsChain<U extends z.UnknownKeysParam> = ObjectBasedEffect<BaseObject<U> | EffectsChain<U>>;
/**
 * @desc The type allowed on the top level of Middlewares and Endpoints
 * @param U — only "strip" is allowed for Middlewares due to intersection issue (Zod) #600
 * */
type IOSchema<U extends z.UnknownKeysParam = z.UnknownKeysParam> = BaseObject<U> | EffectsChain<U> | RawSchema | z.ZodUnion<[IOSchema<U>, ...IOSchema<U>[]]> | z.ZodIntersection<IOSchema<U>, IOSchema<U>> | z.ZodDiscriminatedUnion<string, BaseObject<U>[]> | z.ZodPipeline<ObjectBasedEffect<BaseObject<U>>, BaseObject<U>>;

declare const methods: ("get" | "post" | "put" | "delete" | "patch")[];
type Method = (typeof methods)[number];

declare const contentTypes: {
    json: string;
    upload: string;
    raw: string;
};
type ContentType = keyof typeof contentTypes;

type ResultSchema<R extends Result> = R extends Result<infer S> ? S : never;

type Handler$1<RES = unknown> = (params: {
    /** null in case of failure to parse or to find the matching endpoint (error: not found) */
    input: FlatObject | null;
    /** null in case of errors or failures */
    output: FlatObject | null;
    /** can be empty: check presence of the required property using "in" operator */
    options: FlatObject;
    error: Error | null;
    request: Request;
    response: Response<RES>;
    logger: ActualLogger;
}) => void | Promise<void>;
type Result<S extends z.ZodTypeAny = z.ZodTypeAny> = S | ApiResponse<S> | ApiResponse<S>[];
type LazyResult<R extends Result, A extends unknown[] = []> = (...args: A) => R;
declare abstract class AbstractResultHandler {
    #private;
    abstract getPositiveResponse(output: IOSchema): NormalizedResponse[];
    abstract getNegativeResponse(): NormalizedResponse[];
    protected constructor(handler: Handler$1);
    execute(...params: Parameters<Handler$1>): void | Promise<void>;
}
declare class ResultHandler<POS extends Result, NEG extends Result> extends AbstractResultHandler {
    #private;
    constructor(params: {
        /** @desc A description of the API response in case of success (schema, status code, MIME type) */
        positive: POS | LazyResult<POS, [IOSchema]>;
        /** @desc A description of the API response in case of error (schema, status code, MIME type) */
        negative: NEG | LazyResult<NEG>;
        /** @desc The actual implementation to transmit the response in any case */
        handler: Handler$1<z.output<ResultSchema<POS> | ResultSchema<NEG>>>;
    });
    getPositiveResponse(output: IOSchema): Required<Pick<ApiResponse<z.ZodTypeAny>, "schema" | "statusCodes" | "mimeTypes">>[];
    getNegativeResponse(): Required<Pick<ApiResponse<z.ZodTypeAny>, "schema" | "statusCodes" | "mimeTypes">>[];
}
declare const defaultResultHandler: ResultHandler<z.ZodObject<{
    status: z.ZodLiteral<"success">;
    data: IOSchema;
}, "strip", z.ZodTypeAny, {
    status: "success";
    data?: unknown;
}, {
    status: "success";
    data?: unknown;
}>, z.ZodObject<{
    status: z.ZodLiteral<"error">;
    error: z.ZodObject<{
        message: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        message: string;
    }, {
        message: string;
    }>;
}, "strip", z.ZodTypeAny, {
    error: {
        message: string;
    };
    status: "error";
}, {
    error: {
        message: string;
    };
    status: "error";
}>>;
/**
 * @deprecated Resist the urge of using it: this handler is designed only to simplify the migration of legacy APIs.
 * @desc Responding with array is a bad practice keeping your endpoints from evolving without breaking changes.
 * @desc This handler expects your endpoint to have the property 'items' in the output object schema
 * */
declare const arrayResultHandler: ResultHandler<z.ZodArray<z.ZodTypeAny, "many">, z.ZodString>;

type Handler<IN, OUT, OPT> = (params: {
    input: IN;
    options: OPT;
    logger: ActualLogger;
}) => Promise<OUT>;
type DescriptionVariant = "short" | "long";
type IOVariant = "input" | "output";
type MimeVariant = Extract<IOVariant, "input"> | ResponseVariant;
declare abstract class AbstractEndpoint {
    abstract execute(params: {
        request: Request;
        response: Response;
        logger: ActualLogger;
        config: CommonConfig;
        siblingMethods?: ReadonlyArray<Method>;
    }): Promise<void>;
    abstract getDescription(variant: DescriptionVariant): string | undefined;
    abstract getMethods(): ReadonlyArray<Method>;
    abstract getSchema(variant: IOVariant): IOSchema;
    abstract getSchema(variant: ResponseVariant): z.ZodTypeAny;
    abstract getMimeTypes(variant: MimeVariant): ReadonlyArray<string>;
    abstract getResponses(variant: ResponseVariant): ReadonlyArray<NormalizedResponse>;
    abstract getSecurity(): LogicalContainer<Security>;
    abstract getScopes(): ReadonlyArray<string>;
    abstract getTags(): ReadonlyArray<string>;
    abstract getOperationId(method: Method): string | undefined;
    abstract getRequestType(): ContentType;
}
declare class Endpoint<IN extends IOSchema, OUT extends IOSchema, OPT extends FlatObject, SCO extends string, TAG extends string> extends AbstractEndpoint {
    #private;
    constructor({ methods, inputSchema, outputSchema, handler, resultHandler, getOperationId, scopes, middlewares, tags, description: long, shortDescription: short, }: {
        middlewares?: AbstractMiddleware[];
        inputSchema: IN;
        outputSchema: OUT;
        handler: Handler<z.output<IN>, z.input<OUT>, OPT>;
        resultHandler: AbstractResultHandler;
        description?: string;
        shortDescription?: string;
        getOperationId?: (method: Method) => string | undefined;
        methods: Method[];
        scopes?: SCO[];
        tags?: TAG[];
    });
    getDescription(variant: DescriptionVariant): string | undefined;
    getMethods(): readonly ("get" | "post" | "put" | "delete" | "patch")[];
    getSchema(variant: "input"): IN;
    getSchema(variant: "output"): OUT;
    getSchema(variant: ResponseVariant): z.ZodTypeAny;
    getMimeTypes(variant: MimeVariant): readonly string[];
    getRequestType(): "raw" | "json" | "upload";
    getResponses(variant: ResponseVariant): readonly Required<Pick<ApiResponse<z.ZodTypeAny>, "schema" | "statusCodes" | "mimeTypes">>[];
    getSecurity(): LogicalContainer<Security>;
    getScopes(): readonly SCO[];
    getTags(): readonly TAG[];
    getOperationId(method: Method): string | undefined;
    execute({ request, response, logger, config, siblingMethods, }: {
        request: Request;
        response: Response;
        logger: ActualLogger;
        config: CommonConfig;
        siblingMethods?: Method[];
    }): Promise<void>;
}

type ChildLoggerExtractor = (request: Request) => ActualLogger;

type InputSource = keyof Pick<Request, "query" | "body" | "files" | "params" | "headers">;
type InputSources = Record<Method, InputSource[]>;
type Headers = Record<string, string>;
type HeadersProvider = (params: {
    /** @desc The default headers to be overridden. */
    defaultHeaders: Headers;
    request: Request;
    endpoint: AbstractEndpoint;
    logger: ActualLogger;
}) => Headers | Promise<Headers>;
type TagsConfig<TAG extends string> = Record<TAG, string | {
    description: string;
    url?: string;
}>;
type ChildLoggerProvider = (params: {
    request: Request;
    parent: ActualLogger;
}) => ActualLogger | Promise<ActualLogger>;
interface CommonConfig<TAG extends string = string> {
    /**
     * @desc Enables cross-origin resource sharing.
     * @link https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
     * @desc You can override the default CORS headers by setting up a provider function here.
     */
    cors: boolean | HeadersProvider;
    /**
     * @desc The ResultHandler to use for handling routing, parsing and upload errors
     * @default defaultResultHandler
     * @see defaultResultHandler
     */
    errorHandler?: AbstractResultHandler;
    /**
     * @desc Built-in logger configuration or an instance of any compatible logger.
     * @example { level: "debug", color: true }
     * */
    logger: BuiltinLoggerConfig | AbstractLogger;
    /**
     * @desc A child logger returned by this function can override the logger in all handlers for each request
     * @example ({ parent }) => parent.child({ requestId: uuid() })
     * */
    childLoggerProvider?: ChildLoggerProvider;
    /**
     * @desc You can disable the startup logo.
     * @default true
     */
    startupLogo?: boolean;
    /**
     * @desc Which properties of request are combined into the input for endpoints and middlewares.
     * @desc The order matters: priority from lowest to highest
     * @default defaultInputSources
     * @see defaultInputSources
     */
    inputSources?: Partial<InputSources>;
    /**
     * @desc Optional endpoints tagging configuration.
     * @example: { users: "Everything about the users" }
     */
    tags?: TagsConfig<TAG>;
}
type BeforeUpload = (params: {
    request: Request;
    logger: ActualLogger;
}) => void | Promise<void>;
type UploadOptions = Pick<express_fileupload__default.Options, "createParentPath" | "uriDecodeFileNames" | "safeFileNames" | "preserveExtension" | "useTempFiles" | "tempFileDir" | "debug" | "uploadTimeout" | "limits"> & {
    /**
     * @desc The error to throw when the file exceeds the configured fileSize limit (handled by errorHandler).
     * @see limits
     * @override limitHandler
     * @example createHttpError(413, "The file is too large")
     * */
    limitError?: Error;
    /**
     * @desc A handler to execute before uploading — it can be used for restrictions by throwing an error.
     * @default undefined
     * @example ({ request }) => { throw createHttpError(403, "Not authorized"); }
     * */
    beforeUpload?: BeforeUpload;
};
type CompressionOptions = Pick<compression.CompressionOptions, "threshold" | "level" | "strategy" | "chunkSize" | "memLevel">;
interface GracefulOptions {
    /**
     * @desc Time given to drain ongoing requests before exit.
     * @default 1000
     * */
    timeout?: number;
    /**
     * @desc Process event (Signal) that triggers the graceful shutdown.
     * @see Signals
     * @default [SIGINT, SIGTERM]
     * */
    events?: string[];
}
type BeforeRouting = (params: {
    app: IRouter;
    /**
     * @desc Root logger, same for all requests
     * @todo reconsider the naming in v21
     * */
    logger: ActualLogger;
    /** @desc Returns a child logger if childLoggerProvider is configured (otherwise root logger) */
    getChildLogger: ChildLoggerExtractor;
}) => void | Promise<void>;
interface ServerConfig<TAG extends string = string> extends CommonConfig<TAG> {
    /** @desc Server configuration. */
    server: {
        /** @desc Port, UNIX socket or custom options. */
        listen: number | string | ListenOptions;
        /**
         * @desc Custom JSON parser.
         * @default express.json()
         * @link https://expressjs.com/en/4x/api.html#express.json
         * */
        jsonParser?: RequestHandler;
        /**
         * @desc Enable or configure uploads handling.
         * @default undefined
         * @requires express-fileupload
         * */
        upload?: boolean | UploadOptions;
        /**
         * @desc Enable or configure response compression.
         * @default undefined
         * @requires compression
         */
        compression?: boolean | CompressionOptions;
        /**
         * @desc Custom raw parser (assigns Buffer to request body)
         * @default express.raw()
         * @link https://expressjs.com/en/4x/api.html#express.raw
         * */
        rawParser?: RequestHandler;
        /**
         * @desc A code to execute before processing the Routing of your API (and before parsing).
         * @desc This can be a good place for express middlewares establishing their own routes.
         * @desc It can help to avoid making a DIY solution based on the attachRouting() approach.
         * @default undefined
         * @example ({ app }) => { app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument)); }
         * */
        beforeRouting?: BeforeRouting;
    };
    /** @desc Enables HTTPS server as well. */
    https?: {
        /** @desc At least "cert" and "key" options required. */
        options: ServerOptions;
        /** @desc Port, UNIX socket or custom options. */
        listen: number | string | ListenOptions;
    };
    /**
     * @desc Rejects new connections and attempts to finish ongoing ones in the specified time before exit.
     * @default undefined
     * */
    gracefulShutdown?: boolean | GracefulOptions;
}
interface AppConfig<TAG extends string = string> extends CommonConfig<TAG> {
    /** @desc Your custom express app or express router instead. */
    app: IRouter;
}
declare function createConfig<TAG extends string>(config: ServerConfig<TAG>): ServerConfig<TAG>;
declare function createConfig<TAG extends string>(config: AppConfig<TAG>): AppConfig<TAG>;

/** @desc this type does not allow props assignment, but it works for reading them when merged with another interface */
type EmptyObject = Record<string, never>;
type FlatObject = Record<string, unknown>;
declare const getMessageFromError: (error: Error) => string;
declare const getStatusCodeFromError: (error: Error) => number;
declare const getExamples: <T extends z.ZodTypeAny, V extends "original" | "parsed" | undefined>({ schema, variant, validate, }: {
    schema: T;
    /**
     * @desc examples variant: original or parsed
     * @example "parsed" — for the case when possible schema transformations should be applied
     * @default "original"
     * @override validate: variant "parsed" activates validation as well
     * */
    variant?: V;
    /**
     * @desc filters out the examples that do not match the schema
     * @default variant === "parsed"
     * */
    validate?: boolean;
}) => ReadonlyArray<V extends "parsed" ? z.output<T> : z.input<T>>;

declare const metaSymbol: unique symbol;
interface Metadata {
    examples: unknown[];
    /** @override ZodDefault::_def.defaultValue() in depictDefault */
    defaultLabel?: string;
    brand?: string | number | symbol;
}

/**
 * @fileoverview Mapping utils for Zod Runtime Plugin (remap)
 * @link https://stackoverflow.com/questions/55454125/typescript-remapping-object-properties-in-typesafe
 */
type TuplesFromObject<T> = {
    [P in keyof T]: [P, T[P]];
}[keyof T];
type GetKeyByValue<T, V> = TuplesFromObject<T> extends infer TT ? TT extends [infer P, V] ? P : never : never;
type Remap<T, U extends {
    [P in keyof T]?: V;
}, V extends string> = {
    [P in NonNullable<U[keyof U]>]: T[GetKeyByValue<U, P>];
};
type Intact<T, U> = {
    [K in Exclude<keyof T, keyof U>]: T[K];
};

declare module "zod" {
    interface ZodTypeDef {
        [metaSymbol]?: Metadata;
    }
    interface ZodType {
        /** @desc Add an example value (before any transformations, can be called multiple times) */
        example(example: this["_input"]): this;
    }
    interface ZodDefault<T extends z.ZodTypeAny> {
        /** @desc Change the default value in the generated Documentation to a label */
        label(label: string): this;
    }
    interface ZodObject<T extends z.ZodRawShape, UnknownKeys extends z.UnknownKeysParam = z.UnknownKeysParam, Catchall extends z.ZodTypeAny = z.ZodTypeAny, Output = z.objectOutputType<T, Catchall, UnknownKeys>, Input = z.objectInputType<T, Catchall, UnknownKeys>> {
        remap<V extends string, U extends {
            [P in keyof T]?: V;
        }>(mapping: U): z.ZodPipeline<z.ZodEffects<this, FlatObject>, // internal type simplified
        z.ZodObject<Remap<T, U, V> & Intact<T, U>, UnknownKeys>>;
        remap<U extends z.ZodRawShape>(mapper: (subject: T) => U): z.ZodPipeline<z.ZodEffects<this, FlatObject>, z.ZodObject<U>>;
    }
}

type BuildProps<IN extends IOSchema, OUT extends IOSchema, MIN extends IOSchema<"strip">, OPT extends FlatObject, SCO extends string, TAG extends string> = {
    input: IN;
    output: OUT;
    handler: Handler<z.output<z.ZodIntersection<MIN, IN>>, z.input<OUT>, OPT>;
    description?: string;
    shortDescription?: string;
    operationId?: string | ((method: Method) => string);
} & ({
    method: Method;
} | {
    methods: Method[];
}) & ({
    scopes?: SCO[];
} | {
    scope?: SCO;
}) & ({
    tags?: TAG[];
} | {
    tag?: TAG;
});
declare class EndpointsFactory<IN extends IOSchema<"strip"> = z.ZodObject<EmptyObject, "strip">, OUT extends FlatObject = EmptyObject, SCO extends string = string, TAG extends string = string> {
    #private;
    protected resultHandler: AbstractResultHandler;
    protected middlewares: AbstractMiddleware[];
    /** @desc Consider using the "config" prop with the "tags" option to enforce constraints on tagging the endpoints */
    constructor(resultHandler: AbstractResultHandler);
    constructor(params: {
        resultHandler: AbstractResultHandler;
        config?: CommonConfig<TAG>;
    });
    addMiddleware<AIN extends IOSchema<"strip">, AOUT extends FlatObject, ASCO extends string>(subject: Middleware<AIN, OUT, AOUT, ASCO> | ConstructorParameters<typeof Middleware<AIN, OUT, AOUT, ASCO>>[0]): EndpointsFactory<z.ZodIntersection<IN, AIN>, OUT & AOUT, SCO & ASCO, TAG>;
    use: <R extends Request, S extends Response, AOUT extends FlatObject = EmptyObject>(nativeMw: (request: R, response: S, next: express.NextFunction) => void | Promise<void>, params_1?: {
        provider?: ((request: R, response: S) => AOUT | Promise<AOUT>) | undefined;
        transformer?: (err: Error) => Error;
    } | undefined) => EndpointsFactory<IN, OUT & AOUT, SCO, TAG>;
    addExpressMiddleware<R extends Request, S extends Response, AOUT extends FlatObject = EmptyObject>(...params: ConstructorParameters<typeof ExpressMiddleware<R, S, AOUT>>): EndpointsFactory<IN, OUT & AOUT, SCO, TAG>;
    addOptions<AOUT extends FlatObject>(getOptions: () => Promise<AOUT>): EndpointsFactory<IN, OUT & AOUT, SCO, TAG>;
    build<BIN extends IOSchema, BOUT extends IOSchema>({ input, handler, output: outputSchema, description, shortDescription, operationId, ...rest }: BuildProps<BIN, BOUT, IN, OUT, SCO, TAG>): Endpoint<z.ZodIntersection<IN, BIN>, BOUT, OUT, SCO, TAG>;
}
declare const defaultEndpointsFactory: EndpointsFactory<z.ZodObject<EmptyObject, "strip", z.ZodTypeAny, {
    [x: string]: never;
}, {
    [x: string]: never;
}>, EmptyObject, string, string>;
/**
 * @deprecated Resist the urge of using it: this factory is designed only to simplify the migration of legacy APIs.
 * @desc Responding with array is a bad practice keeping your endpoints from evolving without breaking changes.
 * @desc The result handler of this factory expects your endpoint to have the property 'items' in the output schema
 */
declare const arrayEndpointsFactory: EndpointsFactory<z.ZodObject<EmptyObject, "strip", z.ZodTypeAny, {
    [x: string]: never;
}, {
    [x: string]: never;
}>, EmptyObject, string, string>;

declare class DependsOnMethod {
    readonly pairs: ReadonlyArray<[Method, AbstractEndpoint]>;
    readonly firstEndpoint: AbstractEndpoint | undefined;
    readonly siblingMethods: ReadonlyArray<Method>;
    constructor(endpoints: Partial<Record<Method, AbstractEndpoint>>);
}

type OriginalStatic = typeof express__default.static;
type StaticHandler = ReturnType<OriginalStatic>;
declare class ServeStatic {
    params: Parameters<OriginalStatic>;
    constructor(...params: Parameters<OriginalStatic>);
    apply(path: string, cb: (path: string, handler: StaticHandler) => void): void;
}

interface Routing {
    [SEGMENT: string]: Routing | DependsOnMethod | AbstractEndpoint | ServeStatic;
}

declare const attachRouting: (config: AppConfig, routing: Routing) => {
    notFoundHandler: express__default.RequestHandler<express_serve_static_core.ParamsDictionary, any, any, qs.ParsedQs, Record<string, any>>;
    logger: AbstractLogger | BuiltinLogger;
};
declare const createServer: (config: ServerConfig, routing: Routing) => Promise<{
    app: express_serve_static_core.Express;
    logger: AbstractLogger | BuiltinLogger;
    httpServer: http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>;
    httpsServer: https.Server<typeof http.IncomingMessage, typeof http.ServerResponse> | undefined;
}>;

declare const variants: {
    buffer: () => z.ZodBranded<z.ZodType<Buffer, z.ZodTypeDef, Buffer>, symbol>;
    string: () => z.ZodBranded<z.ZodString, symbol>;
    binary: () => z.ZodBranded<z.ZodUnion<[z.ZodType<Buffer, z.ZodTypeDef, Buffer>, z.ZodString]>, symbol>;
    base64: () => z.ZodBranded<z.ZodString, symbol>;
};
type Variants = typeof variants;
type Variant = keyof Variants;
declare function file(): ReturnType<Variants["string"]>;
declare function file<K extends Variant>(variant: K): ReturnType<Variants[K]>;

declare const ez: {
    dateIn: () => zod.ZodBranded<zod.ZodPipeline<zod.ZodEffects<zod.ZodUnion<[zod.ZodString, zod.ZodString, zod.ZodString]>, Date, string>, zod.ZodEffects<zod.ZodDate, Date, Date>>, symbol>;
    dateOut: () => zod.ZodBranded<zod.ZodEffects<zod.ZodEffects<zod.ZodDate, Date, Date>, string, Date>, symbol>;
    file: typeof file;
    upload: () => zod.ZodBranded<zod.ZodType<express_fileupload.UploadedFile, zod.ZodTypeDef, express_fileupload.UploadedFile>, symbol>;
    raw: <S extends zod.ZodRawShape>(extra?: S) => zod.ZodBranded<zod.ZodObject<zod.objectUtil.extendShape<{
        raw: zod.ZodBranded<zod.ZodType<Buffer, zod.ZodTypeDef, Buffer>, symbol>;
    }, S>, "strip", zod.ZodTypeAny, zod.objectUtil.addQuestionMarks<zod.baseObjectOutputType<zod.objectUtil.extendShape<{
        raw: zod.ZodBranded<zod.ZodType<Buffer, zod.ZodTypeDef, Buffer>, symbol>;
    }, S>>, any> extends infer T ? { [k in keyof T]: zod.objectUtil.addQuestionMarks<zod.baseObjectOutputType<zod.objectUtil.extendShape<{
        raw: zod.ZodBranded<zod.ZodType<Buffer, zod.ZodTypeDef, Buffer>, symbol>;
    }, S>>, any>[k]; } : never, zod.baseObjectInputType<zod.objectUtil.extendShape<{
        raw: zod.ZodBranded<zod.ZodType<Buffer, zod.ZodTypeDef, Buffer>, symbol>;
    }, S>> extends infer T_1 ? { [k_1 in keyof T_1]: zod.baseObjectInputType<zod.objectUtil.extendShape<{
        raw: zod.ZodBranded<zod.ZodType<Buffer, zod.ZodTypeDef, Buffer>, symbol>;
    }, S>>[k_1]; } : never>, symbol>;
};

interface NextHandlerInc<U> {
    next: (schema: z.ZodTypeAny) => U;
}
interface PrevInc<U> {
    prev: U;
}
type SchemaHandler<U, Context extends FlatObject = EmptyObject, Variant extends "regular" | "each" | "last" = "regular"> = (schema: any, // eslint-disable-line @typescript-eslint/no-explicit-any -- for assignment compatibility
ctx: Context & (Variant extends "regular" ? NextHandlerInc<U> : Variant extends "each" ? PrevInc<U> : Context)) => U;
type HandlingRules<U, Context extends FlatObject = EmptyObject, K extends string | symbol = string | symbol> = Partial<Record<K, SchemaHandler<U, Context>>>;

interface OpenAPIContext extends FlatObject {
    isResponse: boolean;
    makeRef: (schema: z.ZodTypeAny, subject: SchemaObject | ReferenceObject | (() => SchemaObject | ReferenceObject), name?: string) => ReferenceObject;
    path: string;
    method: Method;
}
type Depicter = SchemaHandler<SchemaObject | ReferenceObject, OpenAPIContext>;

type Component = "positiveResponse" | "negativeResponse" | "requestParameter" | "requestBody";
/** @desc user defined function that creates a component description from its properties */
type Descriptor = (props: Record<"method" | "path" | "operationId", string> & {
    statusCode?: number;
}) => string;
interface DocumentationParams {
    title: string;
    version: string;
    serverUrl: string | [string, ...string[]];
    routing: Routing;
    config: CommonConfig;
    /**
     * @desc Descriptions of various components based on their properties (method, path, operationId).
     * @desc When composition set to "components", component name is generated from this description
     * @default () => `${method} ${path} ${component}`
     * */
    descriptions?: Partial<Record<Component, Descriptor>>;
    /** @default true */
    hasSummaryFromDescription?: boolean;
    /** @default inline */
    composition?: "inline" | "components";
    /**
     * @deprecated no longer used
     * @todo remove in v21
     * */
    serializer?: (schema: z.ZodTypeAny) => string;
    /**
     * @desc Handling rules for your own branded schemas.
     * @desc Keys: brands (recommended to use unique symbols).
     * @desc Values: functions having schema as first argument that you should assign type to, second one is a context.
     * @example { MyBrand: ( schema: typeof myBrandSchema, { next } ) => ({ type: "object" })
     */
    brandHandling?: HandlingRules<SchemaObject | ReferenceObject, OpenAPIContext>;
}
declare class Documentation extends OpenApiBuilder {
    protected lastSecuritySchemaIds: Map<SecuritySchemeType, number>;
    protected lastOperationIdSuffixes: Map<string, number>;
    protected responseVariants: ("positive" | "negative")[];
    protected references: Map<z.ZodTypeAny, string>;
    protected makeRef(schema: z.ZodTypeAny, subject: SchemaObject | ReferenceObject | (() => SchemaObject | ReferenceObject), name?: string | undefined): ReferenceObject;
    protected ensureUniqOperationId(path: string, method: Method, userDefined?: string): string;
    protected ensureUniqSecuritySchemaName(subject: SecuritySchemeObject): string;
    constructor({ routing, config, title, version, serverUrl, descriptions, brandHandling, hasSummaryFromDescription, composition, }: DocumentationParams);
}

/** @desc An error related to the wrong Routing declaration */
declare class RoutingError extends Error {
    name: string;
}
/**
 * @desc An error related to the generating of the documentation
 * */
declare class DocumentationError extends Error {
    name: string;
    constructor({ message, method, path, isResponse, }: {
        message: string;
    } & Pick<OpenAPIContext, "path" | "method" | "isResponse">);
}
/** @desc An error related to the input and output schemas declaration */
declare class IOSchemaError extends Error {
    name: string;
}
/** @desc An error of validating the Endpoint handler's returns against the Endpoint output schema */
declare class OutputValidationError extends IOSchemaError {
    readonly originalError: z.ZodError;
    name: string;
    constructor(originalError: z.ZodError);
}
/** @desc An error of validating the input sources against the Middleware or Endpoint input schema */
declare class InputValidationError extends IOSchemaError {
    readonly originalError: z.ZodError;
    name: string;
    constructor(originalError: z.ZodError);
}
declare class MissingPeerError extends Error {
    name: string;
    constructor(module: string);
}

interface TestingProps<REQ, LOG> {
    /**
     * @desc Additional properties to set on Request mock
     * @default { method: "GET", headers: { "content-type": "application/json" } }
     * */
    requestProps?: REQ;
    /**
     * @link https://www.npmjs.com/package/node-mocks-http
     * @default { req: requestMock }
     * */
    responseOptions?: ResponseOptions;
    /**
     * @desc Additional properties to set on config mock
     * @default { cors: false, logger }
     * */
    configProps?: Partial<CommonConfig>;
    /**
     * @desc Additional properties to set on logger mock
     * @default { info, warn, error, debug }
     * */
    loggerProps?: LOG;
}
declare const testEndpoint: <LOG extends FlatObject, REQ extends RequestOptions>({ endpoint, ...rest }: TestingProps<REQ, LOG> & {
    /** @desc The endpoint to test */
    endpoint: AbstractEndpoint;
}) => Promise<{
    requestMock: Request<express_serve_static_core.ParamsDictionary, any, any, qs.ParsedQs, Record<string, any>> & {
        [key: string]: any;
        _setParameter: (key: string, value?: string) => void;
        _setSessionVariable: (variable: string, value?: string) => void;
        _setCookiesVariable: (variable: string, value?: string) => void;
        _setSignedCookiesVariable: (variable: string, value?: string) => void;
        _setHeadersCookiesVariable: (variable: string, value: string) => void;
        _setFilesCookiesVariable: (variable: string, value?: string) => void;
        _setMethod: (method?: string) => void;
        _setURL: (value?: string) => void;
        _setOriginalUrl: (value?: string) => void;
        _setBody: (body?: node_mocks_http.Body) => void;
        _addBody: (key: string, value?: any) => void;
    } & REQ;
    responseMock: node_mocks_http.MockResponse<Response<any, Record<string, any>>>;
    loggerMock: AbstractLogger & LOG & {
        _getLogs: () => Record<"debug" | "info" | "warn" | "error", unknown[]>;
    };
}>;
declare const testMiddleware: <LOG extends FlatObject, REQ extends RequestOptions>({ middleware, options, ...rest }: TestingProps<REQ, LOG> & {
    /** @desc The middleware to test */
    middleware: AbstractMiddleware;
    /** @desc The aggregated output from previously executed middlewares */
    options?: FlatObject;
}) => Promise<{
    requestMock: Request<express_serve_static_core.ParamsDictionary, any, any, qs.ParsedQs, Record<string, any>> & {
        [key: string]: any;
        _setParameter: (key: string, value?: string) => void;
        _setSessionVariable: (variable: string, value?: string) => void;
        _setCookiesVariable: (variable: string, value?: string) => void;
        _setSignedCookiesVariable: (variable: string, value?: string) => void;
        _setHeadersCookiesVariable: (variable: string, value: string) => void;
        _setFilesCookiesVariable: (variable: string, value?: string) => void;
        _setMethod: (method?: string) => void;
        _setURL: (value?: string) => void;
        _setOriginalUrl: (value?: string) => void;
        _setBody: (body?: node_mocks_http.Body) => void;
        _addBody: (key: string, value?: any) => void;
    } & REQ;
    responseMock: node_mocks_http.MockResponse<Response<any, Record<string, any>>>;
    loggerMock: AbstractLogger & LOG & {
        _getLogs: () => Record<"debug" | "info" | "warn" | "error", unknown[]>;
    };
    output: FlatObject;
}>;

interface ZTSContext extends FlatObject {
    isResponse: boolean;
    makeAlias: (schema: z.ZodTypeAny, produce: () => ts.TypeNode) => ts.TypeReferenceNode;
    optionalPropStyle: {
        withQuestionMark?: boolean;
        withUndefined?: boolean;
    };
}
type Producer = SchemaHandler<ts.TypeNode, ZTSContext>;

type IOKind = "input" | "response" | ResponseVariant;
interface IntegrationParams {
    routing: Routing;
    /**
     * @desc What should be generated
     * @example "types" — types of your endpoint requests and responses (for a DIY solution)
     * @example "client" — an entity for performing typed requests and receiving typed responses
     * @default "client"
     * */
    variant?: "types" | "client";
    /**
     * @desc Declares positive and negative response types separately and provides them within additional dictionaries
     * @default false
     * */
    splitResponse?: boolean;
    /**
     * @deprecated no longer used
     * @todo remove in v21
     * */
    serializer?: (schema: z.ZodTypeAny) => string;
    /**
     * @desc configures the style of object's optional properties
     * @default { withQuestionMark: true, withUndefined: true }
     */
    optionalPropStyle?: {
        /**
         * @desc add question mark to the optional property definition
         * @example { someProp?: boolean }
         * */
        withQuestionMark?: boolean;
        /**
         * @desc add undefined to the property union type
         * @example { someProp: boolean | undefined }
         */
        withUndefined?: boolean;
    };
    /**
     * @desc Handling rules for your own branded schemas.
     * @desc Keys: brands (recommended to use unique symbols).
     * @desc Values: functions having schema as first argument that you should assign type to, second one is a context.
     * @example { MyBrand: ( schema: typeof myBrandSchema, { next } ) => createKeywordTypeNode(SyntaxKind.AnyKeyword)
     */
    brandHandling?: HandlingRules<ts.TypeNode, ZTSContext>;
}
interface FormattedPrintingOptions {
    /** @desc Typescript printer options */
    printerOptions?: ts.PrinterOptions;
    /**
     * @desc Typescript code formatter
     * @default prettier.format
     * */
    format?: (program: string) => Promise<string>;
}
declare class Integration {
    protected program: ts.Node[];
    protected usage: Array<ts.Node | string>;
    protected registry: Map<{
        method: Method;
        path: string;
    }, Partial<Record<IOKind, string>> & {
        isJson: boolean;
        tags: ReadonlyArray<string>;
    }>;
    protected paths: string[];
    protected aliases: Map<z.ZodTypeAny, ts.TypeAliasDeclaration>;
    protected ids: {
        pathType: ts.Identifier;
        methodType: ts.Identifier;
        methodPathType: ts.Identifier;
        inputInterface: ts.Identifier;
        posResponseInterface: ts.Identifier;
        negResponseInterface: ts.Identifier;
        responseInterface: ts.Identifier;
        jsonEndpointsConst: ts.Identifier;
        endpointTagsConst: ts.Identifier;
        providerType: ts.Identifier;
        implementationType: ts.Identifier;
        clientClass: ts.Identifier;
        keyParameter: ts.Identifier;
        pathParameter: ts.Identifier;
        paramsArgument: ts.Identifier;
        methodParameter: ts.Identifier;
        accumulator: ts.Identifier;
        provideMethod: ts.Identifier;
        implementationArgument: ts.Identifier;
        headersProperty: ts.Identifier;
        hasBodyConst: ts.Identifier;
        undefinedValue: ts.Identifier;
        bodyProperty: ts.Identifier;
        responseConst: ts.Identifier;
        searchParamsConst: ts.Identifier;
        exampleImplementationConst: ts.Identifier;
        clientConst: ts.Identifier;
    };
    protected interfaces: Array<{
        id: ts.Identifier;
        kind: IOKind;
        props: ts.PropertySignature[];
    }>;
    protected makeAlias(schema: z.ZodTypeAny, produce: () => ts.TypeNode): ts.TypeReferenceNode;
    constructor({ routing, brandHandling, variant, splitResponse, optionalPropStyle, }: IntegrationParams);
    protected printUsage(printerOptions?: ts.PrinterOptions): string | undefined;
    print(printerOptions?: ts.PrinterOptions): string;
    printFormatted({ printerOptions, format: userDefined, }?: FormattedPrintingOptions): Promise<string>;
}

export { type ApiResponse, type AppConfig, type BasicSecurity, type BearerSecurity, BuiltinLogger, type CommonConfig, type CookieSecurity, type CustomHeaderSecurity, DependsOnMethod, type Depicter, Documentation, DocumentationError, EndpointsFactory, type FlatObject, type IOSchema, type InputSecurity, InputValidationError, Integration, type LoggerOverrides, type Method, Middleware, MissingPeerError, type OAuth2Security, type OpenIdSecurity, OutputValidationError, type Producer, ResultHandler, type Routing, RoutingError, ServeStatic, type ServerConfig, arrayEndpointsFactory, arrayResultHandler, attachRouting, createConfig, createServer, defaultEndpointsFactory, defaultResultHandler, ez, getExamples, getMessageFromError, getStatusCodeFromError, testEndpoint, testMiddleware };
