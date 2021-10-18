const out = `
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

console.log(out);
