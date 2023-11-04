import { Request, Response } from "express";
import http from "node:http";
import { Logger } from "winston";
import { CommonConfig } from "./config-type";
import { AbstractEndpoint } from "./endpoint";
import { mimeJson } from "./mime";

type MockFunction = <S>(implementation?: (...args: unknown[]) => unknown) => S;

interface TestEndpointProps<REQ, RES, LOG, FN extends MockFunction> {
  endpoint: AbstractEndpoint;
  requestProps?: REQ;
  responseProps?: RES;
  configProps?: Partial<CommonConfig>;
  loggerProps?: LOG;
  mockFn: FN; // jest.fn or vi.fn
}

export const makeRequestMock = <REQ, FN extends MockFunction>({
  mockFn,
  requestProps,
}: {
  mockFn: FN;
  requestProps?: REQ;
}) =>
  <
    { method: string } & Record<"header", ReturnType<FN>> &
      (REQ extends undefined ? {} : REQ)
  >{
    method: "GET",
    header: mockFn(() => mimeJson),
    ...requestProps,
  };

export const makeResponseMock = <RES, FN extends MockFunction>({
  mockFn,
  responseProps,
}: {
  mockFn: FN;
  responseProps?: RES;
}) => {
  const responseMock = <
    {
      writableEnded: boolean;
      statusCode: number;
      statusMessage: string;
    } & Record<
      "set" | "setHeader" | "header" | "status" | "json" | "send" | "end",
      ReturnType<FN>
    > &
      (RES extends undefined ? {} : RES)
  >{
    writableEnded: false,
    statusCode: 200,
    statusMessage: http.STATUS_CODES[200],
    set: mockFn(() => responseMock),
    setHeader: mockFn(() => responseMock),
    header: mockFn(() => responseMock),
    status: mockFn((code) => {
      if (typeof code === "number") {
        responseMock.statusCode = code;
        responseMock.statusMessage = http.STATUS_CODES[code]!;
      }
      return responseMock;
    }),
    json: mockFn(() => responseMock),
    send: mockFn(() => responseMock),
    end: mockFn(() => {
      responseMock.writableEnded = true;
      return responseMock;
    }),
    ...responseProps,
  };
  return responseMock;
};

/**
 * @description You need to install Jest or Vitest to use this feature
 */
export const testEndpoint = async <
  FN extends MockFunction,
  REQ extends Partial<Record<keyof Request, any>> | undefined = undefined,
  RES extends Partial<Record<keyof Response, any>> | undefined = undefined,
  LOG extends Partial<Record<keyof Logger, any>> | undefined = undefined,
>({
  endpoint,
  requestProps,
  responseProps,
  configProps,
  loggerProps,
  mockFn,
}: TestEndpointProps<REQ, RES, LOG, FN>) => {
  const requestMock = makeRequestMock({ mockFn, requestProps });
  const responseMock = makeResponseMock({ mockFn, responseProps });
  const loggerMock = <
    Record<"info" | "warn" | "error" | "debug", ReturnType<FN>> &
      (LOG extends undefined ? {} : LOG)
  >{
    info: mockFn(),
    warn: mockFn(),
    error: mockFn(),
    debug: mockFn(),
    ...loggerProps,
  };
  const configMock = {
    cors: false,
    logger: loggerMock,
    ...configProps,
  };
  await endpoint.execute({
    request: requestMock as unknown as Request,
    response: responseMock as unknown as Response,
    config: configMock as CommonConfig,
    logger: loggerMock as unknown as Logger,
  });
  return { requestMock, responseMock, loggerMock };
};
