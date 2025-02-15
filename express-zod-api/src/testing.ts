import { Request, Response } from "express";
import { ensureError, FlatObject, getInput } from "./common-helpers";
import { CommonConfig } from "./config-type";
import { AbstractEndpoint } from "./endpoint";
import {
  AbstractLogger,
  ActualLogger,
  isSeverity,
  Severity,
} from "./logger-helpers";
import { contentTypes } from "./content-type";
import {
  createRequest,
  RequestOptions,
  createResponse,
  ResponseOptions,
} from "node-mocks-http";
import { AbstractMiddleware } from "./middleware";

export const makeRequestMock = <REQ extends RequestOptions>(props?: REQ) => {
  const mock = createRequest<Request>({
    ...props,
    headers: { "content-type": contentTypes.json, ...props?.headers },
  });
  return mock as typeof mock & REQ;
};

export const makeResponseMock = (opt?: ResponseOptions) =>
  createResponse<Response>(opt);

export const makeLoggerMock = <LOG extends FlatObject>(loggerProps?: LOG) => {
  const logs: Record<Severity, unknown[]> = {
    warn: [],
    error: [],
    info: [],
    debug: [],
  };
  return new Proxy(
    (loggerProps || {}) as AbstractLogger &
      LOG & { _getLogs: () => typeof logs },
    {
      get(target, prop, recv) {
        if (prop === "_getLogs") return () => logs;
        if (isSeverity(prop))
          return (...args: unknown[]) => logs[prop].push(args);
        return Reflect.get(target, prop, recv);
      },
    },
  );
};

const makeTestingMocks = <LOG extends FlatObject, REQ extends RequestOptions>({
  requestProps,
  responseOptions,
  configProps,
  loggerProps,
}: TestingProps<REQ, LOG>) => {
  const requestMock = makeRequestMock(requestProps);
  const responseMock = makeResponseMock({
    req: requestMock, // this works only for res.format()
    ...responseOptions,
  });
  /** @link https://github.com/expressjs/express/blob/2a980ad16052e53b398c9953fea50e3daa0b495c/lib/middleware/init.js#L31-L32 */
  responseMock.req = responseOptions?.req || requestMock;
  requestMock.res = responseMock;
  const loggerMock = makeLoggerMock(loggerProps);
  const configMock = {
    cors: false,
    logger: loggerMock,
    ...configProps,
  };
  return { requestMock, responseMock, loggerMock, configMock };
};

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

export const testEndpoint = async <
  LOG extends FlatObject,
  REQ extends RequestOptions,
>({
  endpoint,
  ...rest
}: TestingProps<REQ, LOG> & {
  /** @desc The endpoint to test */
  endpoint: AbstractEndpoint;
}) => {
  const { requestMock, responseMock, loggerMock, configMock } =
    makeTestingMocks(rest);
  await endpoint.execute({
    request: requestMock,
    response: responseMock,
    config: configMock as CommonConfig,
    logger: loggerMock as ActualLogger,
  });
  return { requestMock, responseMock, loggerMock };
};

export const testMiddleware = async <
  LOG extends FlatObject,
  REQ extends RequestOptions,
>({
  middleware,
  options = {},
  errorHandler,
  ...rest
}: TestingProps<REQ, LOG> & {
  /** @desc The middleware to test */
  middleware: AbstractMiddleware;
  /** @desc The aggregated output from previously executed middlewares */
  options?: FlatObject;
  /** @desc Enables transforming possible middleware errors into response, so that test Middleware does not throw */
  errorHandler?: (error: Error, response: Response) => void;
}) => {
  const { requestMock, responseMock, loggerMock, configMock } =
    makeTestingMocks(rest);
  const input = getInput(requestMock, configMock.inputSources);
  try {
    const output = await middleware.execute({
      request: requestMock,
      response: responseMock,
      logger: loggerMock,
      input,
      options,
    });
    return { requestMock, responseMock, loggerMock, output };
  } catch (error) {
    if (!errorHandler) throw error;
    errorHandler(ensureError(error), responseMock);
    return { requestMock, responseMock, loggerMock, output: {} };
  }
};
