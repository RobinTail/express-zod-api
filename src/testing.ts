import { Request } from "express";
import { FlatObject } from "./common-helpers";
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

export const makeRequestMock = <REQ extends RequestOptions>(props?: REQ) => {
  const mock = createRequest<Request>({
    ...props,
    headers: { "content-type": contentTypes.json, ...props?.headers },
  });
  return mock as typeof mock & REQ;
};

export const makeResponseMock = (responseOptions?: ResponseOptions) =>
  createResponse<LocalResponse>(responseOptions);

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

interface TestEndpointProps<REQ, LOG> {
  /** @desc The endpoint to test */
  endpoint: AbstractEndpoint;
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
  requestProps,
  responseOptions,
  configProps,
  loggerProps,
}: TestEndpointProps<REQ, LOG>) => {
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
  await endpoint.execute({
    request: requestMock,
    response: responseMock,
    config: configMock as CommonConfig,
    logger: loggerMock as ActualLogger,
  });
  return { requestMock, responseMock, loggerMock };
};
