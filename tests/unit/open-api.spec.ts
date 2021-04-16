import {routing} from '../../example/routing';
import {endpointsFactory} from '../../example/factories';
import {z, generateOpenApi} from '../../src';

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

    test('should generate the correct schema for complex types', () => {
      const literalValue = 'something';
      const spec = generateOpenApi({
        routing: {
          v1: {
            getSomething: endpointsFactory.build({
              methods: ['get'],
              input: z.object({
                array: z.array(z.number().int().positive()),
                transformer: z.string().transform((str) => str.length)
              }),
              output: z.object({
                literal: z.literal(literalValue),
                transformation: z.number(),
              }),
              handler: async ({input}) => ({
                literal: literalValue as typeof literalValue,
                transformation: input.transformer,
              })
            })
          }
        },
        version: '3.4.5',
        title: 'Testing Complex Types',
        serverUrl: 'http://example.com'
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });
  });
});
