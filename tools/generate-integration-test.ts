import fs from 'fs';

const nodeVersion = process.versions.node.split('.').shift();

const packageJson = `
{
  "name": "express-zod-api-integration-test",
  "version": "1.0.0",
  "scripts": {
    "start": "ts-node quick-start.ts"
  },
  "author": {
    "name": "Anna Bocharova",
    "url": "https://robintail.cz",
    "email": "me@robintail.cz"
  },
  "license": "MIT",
  "dependencies": {
    "@tsconfig/node${nodeVersion}": "latest",
    "express-zod-api": "latest",
    "ts-node": "10.3.0",
    "typescript": "4.4.4"
  }
}
`;

const tsConfigJson = `
{
  "extends": "@tsconfig/node${nodeVersion}/tsconfig.json",
}
`;

const quickStart = `
import {createConfig} from 'express-zod-api';

const config = createConfig({
  server: {
    listen: 8090, // port or socket
  },
  cors: true,
  logger: {
    level: 'debug',
    color: true
  }
});

import {defaultEndpointsFactory} from 'express-zod-api';

import {z} from 'express-zod-api';

const helloWorldEndpoint = defaultEndpointsFactory.build({
  method: 'get',
  input: z.object({ // for empty input use z.object({})
    name: z.string().optional(),
  }),
  output: z.object({
    greetings: z.string(),
  }),
  handler: async ({input: {name}, options, logger}) => {
    logger.debug('Options:', options); // middlewares provide options
    return { greetings: \`Hello, \${name || 'World'}. Happy coding!\` };
  }
});

import {Routing} from 'express-zod-api';

const routing: Routing = {
  v1: {
    hello: helloWorldEndpoint
  }
};

import {createServer} from 'express-zod-api';

createServer(config, routing);
`;

const dir = './tests/integration';
fs.writeFileSync(`${dir}/package.json`, packageJson.trim());
fs.writeFileSync(`${dir}/tsconfig.json`, packageJson.trim());
fs.writeFileSync(`${dir}/quick-start.ts`, quickStart.trim());
