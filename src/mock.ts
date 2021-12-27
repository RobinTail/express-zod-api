import { Request, Response } from "express";
import { Logger } from "winston";
import { CommonConfig } from "./config-type";
import { AbstractEndpoint } from "./endpoint";
import { createHttpError } from "./index";
import { mimeJson } from "./mime";

interface TestEndpointProps<REQ, RES, LOG> {
  endpoint: AbstractEndpoint;
  requestProps?: REQ;
  responseProps?: RES;
  configProps?: Partial<CommonConfig>;
  loggerProps?: LOG;
  /** @deprecated for testing purposes only */
  __noJest?: boolean;
}

/**
 * @description You need to install Jest and probably @types/jest to use this method
 */
export const testEndpoint = async <
  REQ extends Partial<Record<keyof Request, any>> | undefined = undefined,
  RES extends Partial<Record<keyof Response, any>> | undefined = undefined,
  LOG extends Partial<Record<keyof Logger, any>> | undefined = undefined
>({
  endpoint,
  requestProps,
  responseProps,
  configProps,
  loggerProps,
  __noJest,
}: TestEndpointProps<REQ, RES, LOG>) => {
  if (!jest || __noJest) {
    throw new Error("You need to install Jest in order to use testEndpoint().");
  }
  const requestMock = <
    { method: string } & Record<"header", jest.Mock> &
      (REQ extends undefined ? {} : REQ)
  >{
    method: "GET",
    header: jest.fn(() => mimeJson),
    ...requestProps,
  };
  const responseMock = <
    {
      writableEnded: boolean;
      statusCode: number;
      statusMessage: string;
    } & Record<"set" | "status" | "json" | "end", jest.Mock> &
      (RES extends undefined ? {} : RES)
  >{
    writableEnded: false,
    statusCode: 200,
    statusMessage: createHttpError(200).message,
    set: jest.fn(() => responseMock),
    status: jest.fn((value) => {
      responseMock.statusCode = value;
      responseMock.statusMessage = createHttpError(value).message;
      return responseMock;
    }),
    json: jest.fn(() => responseMock),
    end: jest.fn(() => {
      responseMock.writableEnded = true;
      return responseMock;
    }),
    ...responseProps,
  };
  const loggerMock = <
    Record<"info" | "warn" | "error" | "debug", jest.Mock> &
      (LOG extends undefined ? {} : LOG)
  >{
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
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
