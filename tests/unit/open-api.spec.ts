import {routing} from '../../example/routing';
import {endpointsFactory} from '../../example/factories';
import {z, OpenAPI} from '../../src';

describe('Open API generator', () => {
  describe('generateOpenApi()', () => {
    test('should generate the correct schema of example routing', () => {
      const spec = new OpenAPI({
        routing,
        version: '1.2.3',
        title: 'Example API',
        serverUrl: 'http://example.com'
      }).builder.getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test('should generate the correct schema for complex types', () => {
      const literalValue = 'something';
      const spec = new OpenAPI({
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
      }).builder.getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test('should generate the correct schema nullable and optional types', () => {
      const spec = new OpenAPI({
        routing: {
          v1: {
            getSomething: endpointsFactory.build({
              methods: ['get'],
              input: z.object({
                optional: z.string().optional(),
              }),
              output: z.object({
                nullable: z.string().nullable(),
              }),
              handler: async () => ({
                nullable: null,
              })
            })
          }
        },
        version: '3.4.5',
        title: 'Testing Nullable and Optional Types',
        serverUrl: 'http://example.com'
      }).builder.getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });
  });
});
