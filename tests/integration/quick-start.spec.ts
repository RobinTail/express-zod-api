import {ChildProcessWithoutNullStreams, spawn} from 'child_process';
import fetch from 'node-fetch';
import {waitFor} from '../helpers';

describe('Integration Test', () => {
  let example: ChildProcessWithoutNullStreams;
  let out = '';
  const listener = (chunk: Buffer) => {
    out += chunk.toString();
  };

  beforeAll(() => {
    example = spawn(
      'yarn',
      ['start'],
      {cwd: './tests/integration'}
    );
    example.stdout.on('data', listener);
    example.stdout.on('data', listener);
  });

  afterAll(async () => {
    example.stdout.removeListener('data', listener);
    example.kill();
    await waitFor(() => example.killed);
  });

  afterEach(() => {
    out = '';
  });

  describe('Quick Start from Readme', () => {
    test('Should listen', async () => {
      await waitFor(() => /Listening 8090/.test(out));
      expect(true).toBeTruthy();
    });

    test('Should handle valid GET request', async () => {
      const response = await fetch('http://localhost:8090/v1/hello?name=Rick');
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual({
        status: 'success',
        data: {
          greetings: 'Hello, Rick. Happy coding!'
        }
      });
    });
  });
});
