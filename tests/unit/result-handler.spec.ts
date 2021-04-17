import {Request, Response} from 'express';
import {defaultResultHandler} from '../../src/result-handler';
import {z, createHttpError} from '../../src';

let loggerMock: any;
let responseMock: any;

describe('ResultHandler', () => {
  describe('defaultResultHandler', () => {
    beforeEach(() => {
      loggerMock = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
      };
      responseMock = {
        status: jest.fn(),
        json: jest.fn()
      };
    });

    test('Should handle generic error', () => {
      const requestMock = {
        method: 'POST',
        url: 'http://something/v1/anything'
      };
      defaultResultHandler({
        error: new Error('Some error'),
        input: { something: 453 },
        output: { anything: 118 },
        request: requestMock as Request,
        response: responseMock as Response,
        logger: loggerMock
      });
      expect(loggerMock.error).toBeCalledTimes(1);
      expect(loggerMock.error.mock.calls[0][0]).toMatch(/^Internal server error\nError: Some error/);
      expect(loggerMock.error.mock.calls[0][0]).toMatch(/\nURL: http:\/\/something\/v1\/anything\n/);
      expect(responseMock.status).toBeCalledWith(500);
      expect(responseMock.json).toBeCalledWith({
        status: 'error',
        error: {
          message: 'Some error'
        }
      });
    });

    test('Should handle schema error', () => {
      const requestMock = {
        method: 'POST',
        url: 'http://something/v1/anything'
      };
      defaultResultHandler({
        error: new z.ZodError([{
          code: 'invalid_type',
          message: 'Expected string, got number',
          path: ['something'],
          expected: 'string',
          received: 'number'
        }]),
        input: { something: 453 },
        output: { anything: 118 },
        request: requestMock as Request,
        response: responseMock as Response,
        logger: loggerMock
      });
      expect(loggerMock.error).toBeCalledTimes(0);
      expect(responseMock.status).toBeCalledWith(400);
      expect(responseMock.json).toBeCalledWith({
        status: 'error',
        error: {
          message: 'something: Expected string, got number'
        }
      });
    });

    test('Should handle HTTP error', () => {
      const requestMock = {
        method: 'POST',
        url: 'http://something/v1/anything'
      };
      defaultResultHandler({
        error: createHttpError(404, 'Something not found'),
        input: { something: 453 },
        output: { anything: 118 },
        request: requestMock as Request,
        response: responseMock as Response,
        logger: loggerMock
      });
      expect(loggerMock.error).toBeCalledTimes(0);
      expect(responseMock.status).toBeCalledWith(404);
      expect(responseMock.json).toBeCalledWith({
        status: 'error',
        error: {
          message: 'Something not found'
        }
      });
    });

    test('Should handle regular response', () => {
      const requestMock = {
        method: 'POST',
        url: 'http://something/v1/anything'
      };
      defaultResultHandler({
        error: null,
        input: { something: 453 },
        output: { anything: 118 },
        request: requestMock as Request,
        response: responseMock as Response,
        logger: loggerMock
      });
      expect(loggerMock.error).toBeCalledTimes(0);
      expect(responseMock.status).toBeCalledWith(200);
      expect(responseMock.json).toBeCalledWith({
        status: 'success',
        data: {
          anything: 118
        }
      });
    });
  });
});
