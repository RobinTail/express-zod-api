import { Request } from "express";
import { FlatObject } from "./common-helpers";
import { CommonConfig } from "./config-type";
import { AbstractEndpoint } from "./endpoint";
import { AbstractLogger, ActualLogger } from "./logger-helpers";
import { contentTypes } from "./content-type";
import { loadAlternativePeer } from "./peer-helpers";
import { LocalResponse } from "./server-helpers";
import {
  createRequest,
  RequestOptions,
  createResponse,
  ResponseOptions,
} from "node-mocks-http";

/**
 * @desc Using module augmentation approach you can set the Mock type of your actual testing framework.
 * @example declare module "express-zod-api" { interface MockOverrides extends Mock {} }
 * @link https://www.typescriptlang.org/docs/handbook/declaration-merging.html#module-augmentation
 * */
export interface MockOverrides {}

/** @desc Compatibility constraints for a function mocking method of a testing framework. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- for assignment compatibility
type MockFunction = (implementation?: (...args: any[]) => any) => MockOverrides;

export const makeRequestMock = <REQ extends RequestOptions>(props?: REQ) => {
  const mock = createRequest<Request>({
    ...props,
    headers: { "content-type": contentTypes.json, ...props?.headers },
  });
  return mock as typeof mock & REQ;
};

export const makeResponseMock = (responseOptions?: ResponseOptions) =>
  createResponse<LocalResponse>(responseOptions);

export const makeLoggerMock = <LOG extends FlatObject>({
  fnMethod,
  loggerProps,
}: {
  fnMethod: MockFunction;
  loggerProps?: LOG;
}) =>
  ({
    info: fnMethod(),
    warn: fnMethod(),
    error: fnMethod(),
    debug: fnMethod(),
    ...loggerProps,
  }) as Record<keyof AbstractLogger, MockOverrides> & LOG;

interface TestEndpointProps<REQ, LOG> {
  /** @desc The endpoint to test */
  endpoint: AbstractEndpoint;
  /**
   * @desc Additional properties to set on Request mock
   * @default { method: "GET", headers: {"content-type": "application/json" } }
   * */
  requestProps?: REQ;
  /** @link https://www.npmjs.com/package/node-mocks-http */
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
  /**
   * @desc Optionally specify the function mocking method of your testing framework
   * @default jest.fn || vi.fn // from vitest
   * @example mock.fn.bind(mock) // from node:test, binding might be necessary
   * */
  fnMethod?: MockFunction;
}

/** @desc Requires either jest (with @types/jest) or vitest or to specify the fnMethod option */
export const testEndpoint = async <
  LOG extends FlatObject,
  REQ extends FlatObject,
>({
  endpoint,
  requestProps,
  responseOptions,
  configProps,
  loggerProps,
  fnMethod: userDefined,
}: TestEndpointProps<REQ, LOG>) => {
  const fnMethod =
    userDefined ||
    (
      await loadAlternativePeer<{ fn: MockFunction }>([
        { moduleName: "vitest", moduleExport: "vi" },
        { moduleName: "@jest/globals", moduleExport: "jest" },
      ])
    ).fn;
  const requestMock = makeRequestMock(requestProps);
  const responseMock = makeResponseMock(responseOptions);
  const loggerMock = makeLoggerMock({ fnMethod, loggerProps });
  const configMock = {
    cors: false,
    logger: loggerMock,
    ...configProps,
  };
  await endpoint.execute({
    request: requestMock,
    response: responseMock,
    config: configMock as CommonConfig,
    logger: loggerMock as unknown as ActualLogger,
  });
  return { requestMock, responseMock, loggerMock };
};
