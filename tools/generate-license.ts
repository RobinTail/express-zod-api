import * as path from 'path';
import * as fs from 'fs';
import * as manifest from '../package.json';

const ownLicense = `
MIT License

Copyright (c) ${new Date().getFullYear()} ${manifest.author.name}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

interface Lib {
  name: string;
  url: string;
  module: string;
}

const libs: Lib[] = [
  {
    name: 'Express',
    url: 'https://github.com/expressjs/express',
    module: 'express',
  },
  {
    name: 'Zod',
    url: 'https://github.com/colinhacks/zod',
    module: 'zod',
  },
  {
    name: 'HTTP Errors',
    url: 'https://github.com/jshttp/http-errors',
    module: 'http-errors',
  },
  {
    name: 'OpenApi3-TS',
    url: 'https://github.com/metadevpro/openapi3-ts',
    module: 'openapi3-ts'
  },
  {
    name: 'Winston',
    url: 'https://github.com/winstonjs/winston',
    module: 'winston'
  },
  {
    name: 'Mime',
    url: 'https://github.com/broofa/mime',
    module: 'mime'
  },
  {
    name: 'Express-FileUpload',
    url: 'https://github.com/richardgirges/express-fileupload',
    module: 'express-fileupload'
  },
  {
    name: 'Lodash',
    url: 'https://github.com/lodash/lodash',
    module: 'lodash.merge',
  }
];

const separator = '\n'.repeat(4);

const otherLicenses = libs.map(({name, url, module}) => {
  const license = fs.readFileSync(path.join('node_modules', module, 'LICENSE'), 'utf-8');
  return `${name} - ${url}\n\n${license.trim()}`;
}).join(separator);

console.log(`${ownLicense.trim()}${separator}${otherLicenses}`);
