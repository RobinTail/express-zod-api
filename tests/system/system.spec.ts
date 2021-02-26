import * as http from 'http';
import fetch from 'node-fetch';
import {createServer, EndpointsFactory, Method, z} from '../../src';

describe('System', () => {
  let server: http.Server;

  beforeAll(() => {
    const routing = {
      v1: {
        test: new EndpointsFactory()
          .addMiddleware({
            input: z.object({
              key: z.string().refine((v) => v === '123', 'Invalid key')
            }),
            middleware: async () => ({
              user: {
                id: 354
              }
            })
          })
          .addMiddleware({
            input: z.object({}).nonstrict(),
            middleware: async ({request, options: {user}}) => ({
              method: request.method.toLowerCase() as Method,
              permissions: user.id === 354 ? ['any'] : []
            })
          })
          .build({
            methods: ['get', 'post'],
            input: z.object({
              something: z.string()
            }),
            output: z.object({
              anything: z.number().positive()
            }).passthrough(), // allow excessive keys
            handler: async ({input: {key, something}, options: {user, permissions, method}}) => ({
              anything: something === 'joke' ? 300 : -100500,
              doubleKey: key.repeat(2),
              userId: user.id,
              permissions,
              method
            })
          })
      }
    };
    server = createServer({
      server: {
        listen: 8055,
        cors: true
      },
      logger: {
        level: 'silent',
        color: false
      }
    }, routing);
  });

  afterAll((done) => {
    server.close(done);
  });

  describe('App', () => {
    test('Is listening', () => {
      expect(server.listening).toBeTruthy();
    });

    test('Should handle valid GET request', async () => {
      const response = await fetch('http://127.0.0.1:8055/v1/test?key=123&something=joke');
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual({
        status: 'success',
        data: {
          anything: 300,
          doubleKey: '123123',
          userId: 354,
          permissions: ['any'],
          method: 'get'
        }
      });
    });

    test('Should handle valid POST request', async () => {
      const response = await fetch('http://127.0.0.1:8055/v1/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          key: '123',
          something: 'joke'
        })
      });
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual({
        status: 'success',
        data: {
          anything: 300,
          doubleKey: '123123',
          userId: 354,
          permissions: ['any'],
          method: 'post'
        }
      });
    });

    test('Should handle invalid method', async () => {
      const response = await fetch('http://127.0.0.1:8055/v1/test', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          key: '123',
          something: 'joke'
        })
      });
      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json).toEqual({
        status: 'error',
        error: {
          message: 'Can not PUT /v1/test'
        }
      });
    });

    test('Should handle malformed body', async () => {
      const response = await fetch('http://127.0.0.1:8055/v1/test', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: '{"key": "123", "something'
      });
      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json).toEqual({
        status: 'error',
        error: {
          message: 'Unexpected end of JSON input'
        }
      });
    });

    test('Should fail when missing content type header', async () => {
      const response = await fetch('http://127.0.0.1:8055/v1/test', {
        method: 'POST',
        body: JSON.stringify({
          key: '123',
          something: 'joke'
        })
      });
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json).toEqual({
        status: 'error',
        error: {
          message: 'key: Required'
        }
      });
    });
  });
});
