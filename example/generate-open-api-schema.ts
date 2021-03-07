import {openApi} from '../src/open-api';
import {routing} from './routing';

console.log(openApi(routing).getSpecAsYaml());
