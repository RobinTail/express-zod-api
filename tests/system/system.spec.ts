import * as http from 'http';
import fetch from 'node-fetch';
import {createServer, EndpointsFactory, z} from '../../src';

describe('System', () => {
  let server: http.Server;

  beforeAll(() => {
    const routing = {
      v1: {
        test: new EndpointsFactory().addMiddleware({
          input: z.object({
            key: z.string().refine((v) => v === '123', 'Invalid key')
          }),
          middleware: () => Promise.resolve({
            user: {
              id: 354
            }
          })
        }).build({
          methods: ['get', 'post'],
          input: z.object({
            something: z.string()
          }),
          output: z.object({
            anything: z.number()
          }),
          handler: ({input: {key, something}, options: {user}}) => Promise.resolve({
            doubleKey: key.repeat(2),
            anything: something === 'joke' ? 300 : 100500,
            userId: user.id
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

    test('Should handle valid request', async () => {
      const response = await fetch('http://127.0.0.1:8055/v1/test?key=123&something=joke');
      const json = await response.json();
      expect(json).toEqual({
        status: 'success',
        data: {
          doubleKey: '123123',
          anything: 300,
          userId: 354
        }
      });
    });
  });
});

