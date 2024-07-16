import { Request } from "express";
import { FlatObject, getInput } from "./common-helpers";
import { CommonConfig } from "./config-type";
import { AbstractEndpoint } from "./endpoint";
import { AbstractLogger, ActualLogger, severity } from "./logger-helpers";
import { contentTypes } from "./content-type";
import { LocalResponse } from "./server-helpers";
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
  createResponse<LocalResponse>(opt);

export const makeLoggerMock = <LOG extends FlatObject>(loggerProps?: LOG) => {
  const logs: Record<keyof AbstractLogger, unknown[]> = {
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
        if (prop === "_getLogs") {
          return () => logs;
        }
        if (prop in severity) {
          return (...args: unknown[]) =>
            logs[prop as keyof AbstractLogger].push(args);
        }
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
    req: requestMock,
    ...responseOptions,
  });
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
  ...rest
}: TestingProps<REQ, LOG> & {
  /** @desc The middleware to test */
  middleware: AbstractMiddleware;
  /** @desc The output aggregated from previous middlewares */
  options?: FlatObject;
}) => {
  const { requestMock, responseMock, loggerMock, configMock } =
    makeTestingMocks(rest);
  const input = getInput(requestMock, configMock.inputSources);
  const output = await middleware.execute({
    request: requestMock,
    response: responseMock,
    logger: loggerMock,
    input,
    options,
  });
  return { requestMock, responseMock, loggerMock, output };
};
