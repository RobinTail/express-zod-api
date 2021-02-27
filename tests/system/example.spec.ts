import fetch from 'node-fetch';
import {spawn, ChildProcessWithoutNullStreams} from 'child_process';

describe('Example', () => {
  let example: ChildProcessWithoutNullStreams;
  let out = '';
  const listener = (chunk: Buffer) => {
    out += chunk.toString();
  };

  beforeAll(() => {
    example = spawn('ts-node', ['example/index.ts']);
    example.stdout.on('data', listener);
  });

  afterAll(async () => {
    example.stdout.removeListener('data', listener);
    example.kill();
    await new Promise((resolve) => {
      const timer = setInterval(() => {
        if (example.killed) {
          clearInterval(timer);
          resolve('OK');
        }
      }, 100);
    });
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

  describe('Negative', () => {
    test('GET request should fail on missing input param', async () => {
      const response = await fetch('http://localhost:8090/v1/getUser?test=123');
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json).toEqual({
        status: 'error',
        error: {
          message: 'id: Required'
        }
      });
    });

    test('GET request should fail on specific value in handler implementation', async () => {
      const response = await fetch('http://localhost:8090/v1/getUser?test=123&id=101');
      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json).toEqual({
        status: 'error',
        error: {
          message: 'User not found'
        }
      });
    });

    test('POST request should fail on auth middleware key check', async () => {
      const response = await fetch('http://localhost:8090/v1/setUser?test=123&id=50', {
        method: 'POST',
        headers: {
          token: '456',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          key: '456',
          id: 50,
          name: 'John Doe'
        }),
      });
      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json).toEqual({
        status: 'error',
        error: {
          message: 'Invalid key'
        }
      });
    });

    test('POST request should fail on auth middleware token check', async () => {
      const response = await fetch('http://localhost:8090/v1/setUser?test=123&id=50', {
        method: 'POST',
        headers: {
          token: '123',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          key: '123',
          id: 50,
          name: 'John Doe'
        }),
      });
      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json).toEqual({
        status: 'error',
        error: {
          message: 'Invalid token'
        }
      });
    });

    test('POST request should fail on schema validation', async () => {
      const response = await fetch('http://localhost:8090/v1/setUser?test=123&id=50', {
        method: 'POST',
        headers: {
          token: '456',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          key: '123',
          id: -50,
          name: 'John Doe'
        }),
      });
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json).toEqual({
        status: 'error',
        error: {
          message: 'id: Value should be greater than or equal to 0'
        }
      });
    });

    test('POST request should fail on specific value in handler implementation', async () => {
      const response = await fetch('http://localhost:8090/v1/setUser?test=123&id=50', {
        method: 'POST',
        headers: {
          token: '456',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          key: '123',
          id: 101,
          name: 'John Doe'
        }),
      });
      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json).toEqual({
        status: 'error',
        error: {
          message: 'User not found'
        }
      });
    });
  });
});
