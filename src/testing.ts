import { Request, Response } from "express";
import http from "node:http";
import { CommonConfig } from "./config-type";
import { AbstractEndpoint } from "./endpoint";
import { AbstractLogger } from "./logger";
import { mimeJson } from "./mime";

type MockFunction = <S>(implementation?: (...args: any[]) => any) => S; // kept "any" for easier compatibility

export const makeRequestMock = <
  REQ extends Record<string, any>,
  FN extends MockFunction,
>({
  fnMethod,
  requestProps,
}: {
  fnMethod: FN;
  requestProps?: REQ;
}) =>
  ({
    method: "GET",
    header: fnMethod(() => mimeJson),
    ...requestProps,
  }) as { method: string } & Record<"header", ReturnType<FN>> & REQ;

export const makeResponseMock = <
  RES extends Record<string, any>,
  FN extends MockFunction,
>({
  fnMethod,
  responseProps,
}: {
  fnMethod: FN;
  responseProps?: RES;
}) => {
  const responseMock = {
    writableEnded: false,
    statusCode: 200,
    statusMessage: http.STATUS_CODES[200],
    set: fnMethod(() => responseMock),
    setHeader: fnMethod(() => responseMock),
    header: fnMethod(() => responseMock),
    status: fnMethod((code) => {
      responseMock.statusCode = code;
      responseMock.statusMessage = http.STATUS_CODES[code]!;
      return responseMock;
    }),
    json: fnMethod(() => responseMock),
    send: fnMethod(() => responseMock),
    end: fnMethod(() => {
      responseMock.writableEnded = true;
      return responseMock;
    }),
    ...responseProps,
  } as {
    writableEnded: boolean;
    statusCode: number;
    statusMessage: string;
  } & Record<
    "set" | "setHeader" | "header" | "status" | "json" | "send" | "end",
    ReturnType<FN>
  > &
    RES;
  return responseMock;
};

interface TestEndpointProps<REQ, RES, LOG, FN> {
  /** @desc The endpoint to test */
  endpoint: AbstractEndpoint;
  /**
   * @desc Additional properties to set on Request mock
   * @default { method: "GET", header: () => "application/json" }
   * */
  requestProps?: REQ;
  /**
   * @desc Additional properties to set on Response mock
   * @default { writableEnded, statusCode, statusMessage, set, setHeader, header, status, json, send, end }
   * */
  responseProps?: RES;
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
   * @example jest.fn
   * @example vi.fn
   * */
  fnMethod: FN;
}

/**
 * @desc You need to install either jest (with @types/jest) or vitest in order to use this method
 * @requires jest
 * @requires vitest
 * */
export const testEndpoint = async <
  FN extends MockFunction,
  LOG extends Record<string, any>,
  REQ extends Record<string, any>,
  RES extends Record<string, any>,
>({
  endpoint,
  requestProps,
  responseProps,
  configProps,
  loggerProps,
  fnMethod,
}: TestEndpointProps<REQ, RES, LOG, FN>) => {
  const requestMock = makeRequestMock({ fnMethod: fnMethod, requestProps });
  const responseMock = makeResponseMock({ fnMethod: fnMethod, responseProps });
  const loggerMock = {
    info: fnMethod(),
    warn: fnMethod(),
    error: fnMethod(),
    debug: fnMethod(),
    ...loggerProps,
  } as Record<keyof AbstractLogger, ReturnType<FN>> & LOG;
  const configMock = {
    cors: false,
    logger: loggerMock,
    ...configProps,
  };
  await endpoint.execute({
    request: requestMock as unknown as Request,
    response: responseMock as unknown as Response,
    config: configMock as CommonConfig,
    logger: loggerMock as AbstractLogger,
  });
  return { requestMock, responseMock, loggerMock };
};
