import {openApi} from '../src/open-api';
import {routing} from './routing';
import {version} from '../package.json';

console.log(openApi({
  routing, version,
  title: 'Example API',
  serverUrl: 'http://example.com'
}).getSpecAsYaml());
