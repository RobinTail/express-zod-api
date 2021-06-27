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
      }).getSpecAsYaml();
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
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test('should generate the correct schema for nullable and optional types', () => {
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
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test('should generate the correct schema for intersection type', () => {
      const spec = new OpenAPI({
        routing: {
          v1: {
            getSomething: endpointsFactory.build({
              methods: ['post'],
              input: z.object({
                intersection: z.intersection(
                  z.object({
                    one: z.string(),
                  }),
                  z.object({
                    two: z.string(),
                  })
                ),
              }),
              output: z.object({
                and: z.object({
                  five: z.number(),
                }).and(z.object({
                  six: z.string()
                })),
              }),
              handler: async () => ({
                and: {
                  five: 5,
                  six: 'six'
                }
              })
            })
          }
        },
        version: '3.4.5',
        title: 'Testing Intersection and And types',
        serverUrl: 'http://example.com'
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });
  });

  test('should generate the correct schema for union type', () => {
    const spec = new OpenAPI({
      routing: {
        v1: {
          getSomething: endpointsFactory.build({
            methods: ['post'],
            input: z.object({
              union: z.union([
                z.object({
                  one: z.string(),
                  two: z.number()
                }),
                z.object({
                  two: z.number(),
                  three: z.string()
                })
              ]),
            }),
            output: z.object({
              or: z.string().or(z.number()),
            }),
            handler: async () => ({
              or: 554
            })
          })
        }
      },
      version: '3.4.5',
      title: 'Testing Union and Or Types',
      serverUrl: 'http://example.com'
    }).getSpecAsYaml();
    expect(spec).toMatchSnapshot();
  });

  test('should handle transformation schema in output', () => {
    const spec = new OpenAPI({
      routing: {
        v1: {
          getSomething: endpointsFactory.build({
            methods: ['post'],
            input: z.object({
              one: z.string(),
              two: z.number()
            }),
            output: z.object({
              transform: z.string().transform((str) => str.length)
            }),
            handler: async () => ({
              transform: 'test'
            })
          })
        }
      },
      version: '3.4.5',
      title: 'Testing Transformation in response schema',
      serverUrl: 'http://example.com'
    }).getSpecAsYaml();
    expect(spec).toMatchSnapshot();
  });

  test('should handle bigint, boolean, date and null', () => {
    const spec = new OpenAPI({
      routing: {
        v1: {
          getSomething: endpointsFactory.build({
            method: 'post',
            input: z.object({
              bigint: z.bigint(),
              boolean: z.boolean(),
              date: z.date()
            }),
            output: z.object({
              null: z.null()
            }),
            handler: async () => ({
              null: null
            })
          })
        }
      },
      version: '3.4.5',
      title: 'Testing additional types',
      serverUrl: 'http://example.com'
    }).getSpecAsYaml();
    expect(spec).toMatchSnapshot();
  });

  test('should throw on unsupported types', () => {
    [
      z.undefined(),
      z.tuple([]),
      z.map(z.any(), z.any()),
      z.function(),
      z.lazy(() => z.any()),
      z.promise(z.any()),
      z.any(),
      z.unknown(),
      z.never(),
      z.void()
    ].forEach((zodType) => {
      expect(() => new OpenAPI({
        routing: {
          v1: {
            getSomething: endpointsFactory.build({
              method: 'post',
              input: z.object({
                property: zodType
              }),
              output: z.object({}),
              handler: async () => ({})
            })
          }
        },
        version: '3.4.5',
        title: 'Testing unsupported types',
        serverUrl: 'http://example.com'
      })).toThrowError(/Zod type Zod\w+ is unsupported/);
    });
  });
});
