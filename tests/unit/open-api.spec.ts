import {routing} from '../../example/routing';
import {generateOpenApi} from '../../src';

describe('Open API generator', () => {
  describe('generateOpenApi()', () => {
    test('should generate the correct schema of example routing', () => {
      const spec = generateOpenApi({
        routing,
        version: '1.2.3',
        title: 'Example API',
        serverUrl: 'http://example.com'
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });
  });
});
