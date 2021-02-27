import fetch from 'node-fetch';
import {spawn, ChildProcessWithoutNullStreams} from 'child_process';

describe('Example', () => {
  let example: ChildProcessWithoutNullStreams;
  let out = '';

  beforeAll(() => {
    example = spawn('yarn', ['start']);
    example.stdout.on('data', (chunk: Buffer) => {
      out += chunk.toString();
    });
  });

  afterAll(() => {
    example.kill();
  });

  describe('Positive', () => {
    test('Should listen', async () => {
      expect(await new Promise((resolve) => {
        const timer = setInterval(() => {
          if (out.match(/Listening 8090/)) {
            clearInterval(timer);
            resolve('OK');
          }
        }, 100);
      })).toBeTruthy();
    });

    test('Should handle valid POST request', async () => {
      const response = await fetch('http://localhost:8090/v1/setUser?test=123&id=50', {
        method: 'POST',
        headers: {
          token: '456',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          key: '123',
          id: 50,
          name: 'John Doe'
        }),
      });
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual({
        status: 'success',
        data: {
          status: "I'll fix it later"
        }
      });
    });

    test('Should handle valid GET request', async () => {
      const response = await fetch('http://localhost:8090/v1/getUser?test=123&id=50');
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual({
        status: 'success',
        data: {
          status: 'Some kind of warning',
          name: 'John Doe'
        }
      });
    });

  });
});
