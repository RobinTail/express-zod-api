import {generateOpenApi} from '../src';
import {routing} from './routing';
import {version} from '../package.json';

console.log(generateOpenApi({
  routing, version,
  title: 'Example API',
  serverUrl: 'http://example.com'
}).getSpecAsYaml());
