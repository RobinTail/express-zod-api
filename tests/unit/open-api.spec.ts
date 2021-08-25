import {routing} from '../../example/routing';
import {z, OpenAPI, defaultEndpointsFactory} from '../../src';
import {expectType} from 'tsd';

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
      const literalValue = 'something' as const;
      const spec = new OpenAPI({
        routing: {
          v1: {
            getSomething: defaultEndpointsFactory.build({
              methods: ['get'],
              input: z.object({
                array: z.array(z.number().int().positive()).min(1).max(3),
                unlimited: z.array(z.boolean()),
                transformer: z.string().transform((str) => str.length)
              }),
              output: z.object({
                literal: z.literal(literalValue),
                transformation: z.number(),
              }),
              handler: async ({input}) => ({
                literal: literalValue,
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
            getSomething: defaultEndpointsFactory.build({
              methods: ['get'],
              input: z.object({
                optional: z.string().optional(),
                optDefault: z.string().optional().default('test'),
                nullish: z.boolean().nullish(),
                nuDefault: z.number().int().positive().nullish().default(123)
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
            getSomething: defaultEndpointsFactory.build({
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
                  five: z.number().int().gte(0),
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

    test('should generate the correct schema for union type', () => {
      const spec = new OpenAPI({
        routing: {
          v1: {
            getSomething: defaultEndpointsFactory.build({
              methods: ['post'],
              input: z.object({
                union: z.union([
                  z.object({
                    one: z.string(),
                    two: z.number().int().positive()
                  }),
                  z.object({
                    two: z.number().int().negative(),
                    three: z.string()
                  })
                ]),
              }),
              output: z.object({
                or: z.string().or(z.number().int().positive()),
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
            getSomething: defaultEndpointsFactory.build({
              methods: ['post'],
              input: z.object({
                one: z.string(),
                two: z.number().int().positive()
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
            getSomething: defaultEndpointsFactory.build({
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

    test('should handle record', () => {
      const spec = new OpenAPI({
        routing: {
          v1: {
            getSomething: defaultEndpointsFactory.build({
              method: 'post',
              input: z.object({}),
              output: z.object({
                record: z.record(z.number().int()),
              }),
              handler: jest.fn()
            })
          }
        },
        version: '3.4.5',
        title: 'Testing record',
        serverUrl: 'http://example.com'
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test('should handle type any', () => {
      const spec = new OpenAPI({
        routing: {
          v1: {
            getSomething: defaultEndpointsFactory.build({
              method: 'get',
              input: z.object({
                any: z.any()
              }),
              output: z.object({
                any: z.any()
              }),
              handler: jest.fn()
            })
          }
        },
        version: '3.4.5',
        title: 'Testing type any',
        serverUrl: 'http://example.com'
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test('should handle different number types', () => {
      const spec = new OpenAPI({
        routing: {
          v1: {
            getSomething: defaultEndpointsFactory.build({
              method: 'post',
              input: z.object({
                double: z.number(),
                doublePositive: z.number().positive(),
                doubleNegative: z.number().negative(),
                doubleLimited: z.number().min(-0.5).max(0.5),
                int: z.number().int(),
                intPositive: z.number().int().positive(),
                intNegative: z.number().int().negative(),
                intLimited: z.number().int().min(-100).max(100),
                zero: z.number().int().nonnegative().nonpositive().optional(),
              }),
              output: z.object({
                bigint: z.bigint()
              }),
              handler: jest.fn()
            })
          }
        },
        version: '3.4.5',
        title: 'Testing numbers',
        serverUrl: 'http://example.com'
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test('should handle different string types', () => {
      const spec = new OpenAPI({
        routing: {
          v1: {
            getSomething: defaultEndpointsFactory.build({
              method: 'post',
              input: z.object({
                regular: z.string(),
                min: z.string().min(1),
                max: z.string().max(15),
                range: z.string().min(2).max(3),
                email: z.string().email(),
                uuid: z.string().uuid(),
                cuid: z.string().cuid(),
                url: z.string().url(),
                numeric: z.string().regex(/\d+/),
                combined: z.string().nonempty().email().regex(/.*@example\.com/si).max(90)
              }),
              output: z.object({
                nonempty: z.string().nonempty()
              }),
              handler: jest.fn()
            })
          }
        },
        version: '3.4.5',
        title: 'Testing strings',
        serverUrl: 'http://example.com'
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test('should handle tuples', () => {
      const spec = new OpenAPI({
        routing: {
          v1: {
            getSomething: defaultEndpointsFactory.build({
              method: 'post',
              input: z.object({
                ofOne: z.tuple([z.boolean()]),
                ofStrings: z.tuple([z.string(), z.string().nullable()]),
                complex: z.tuple([z.boolean(), z.string(), z.number().int().positive()])
              }),
              output: z.object({
                empty: z.tuple([])
              }),
              handler: jest.fn()
            })
          }
        },
        version: '3.4.5',
        title: 'Testing tuples',
        serverUrl: 'http://example.com'
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test('should handle enum types', () => {
      const spec = new OpenAPI({
        routing: {
          v1: {
            getSomething: defaultEndpointsFactory.build({
              method: 'post',
              input: z.object({
                regularEnum: z.enum(['ABC', 'DEF']),
              }),
              output: z.object({
                nativeEnum: z.nativeEnum({FEG: 1, XYZ: 2})
              }),
              handler: async () => ({
                nativeEnum: 1
              })
            })
          }
        },
        version: '3.4.5',
        title: 'Testing enums',
        serverUrl: 'http://example.com'
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test('should handle z.preprocess()', () => {
      const string = z.preprocess((arg) => String(arg), z.string());
      const number = z.preprocess((arg) => parseInt(String(arg), 16), z.number().int().nonnegative());
      const boolean = z.preprocess((arg) => !!arg, z.boolean());
      const spec = new OpenAPI({
        routing: {
          v1: {
            getSomething: defaultEndpointsFactory.build({
              method: 'get',
              input: z.object({ string, number }),
              output: z.object({ boolean }),
              handler: async () => ({
                boolean: [] as unknown as boolean // @todo check this out without type forcing in future Zod versions
              })
            })
          }
        },
        version: '3.4.5',
        title: 'Testing z.preprocess()',
        serverUrl: 'http://example.com'
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
      expect(string.parse(123)).toBe('123');
      expect(number.parse('0xFF')).toBe(255);
      expect(boolean.parse([])).toBe(true);
      expect(boolean.parse('')).toBe(false);
      expect(boolean.parse(null)).toBe(false);
    });

    test('should throw on unsupported types', () => {
      [
        z.undefined(),
        z.map(z.any(), z.any()),
        z.function(),
        z.lazy(() => z.any()),
        z.promise(z.any()),
        z.unknown(),
        z.never(),
        z.void()
      ].forEach((zodType) => {
        expect(() => new OpenAPI({
          routing: {
            v1: {
              getSomething: defaultEndpointsFactory.build({
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

  describe('Issue #98', () => {
    test('Should describe non-empty array', () => {
      // There is no such class as ZodNonEmptyArray in Zod v3.7.0+
      // It existed though in Zod v3.6.x:
      // @see https://github.com/colinhacks/zod/blob/v3.6.1/src/types.ts#L1204
      const spec = new OpenAPI({
        routing: {
          v1: {
            getSomething: defaultEndpointsFactory.build({
              methods: ['get', 'post'],
              input: z.object({
                arr: z.array(z.string()).nonempty(),
              }),
              output: z.object({
                arr: z.array(z.string()).nonempty()
              }),
              handler: async ({input}) => ({
                arr: input.arr
              })
            })
          }
        },
        version: '3.4.5',
        title: 'Testing issue #98',
        serverUrl: 'http://example.com'
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test('should union schemas', () => {
      const baseSchema = z.object({ id: z.string() });
      const subType1 = baseSchema.extend({ field1: z.string() });
      const subType2 = baseSchema.extend({ field2: z.string() });
      const unionSchema = z.union([subType1, subType2]);
      type TestingType = z.infer<typeof unionSchema>;

      expectType<TestingType>({id: 'string', field1: 'string'});
      expectType<TestingType>({id: 'string', field2: 'string'});

      const spec = new OpenAPI({
        routing: {
          v1: {
            getSomething: defaultEndpointsFactory.build({
              method: 'post',
              input: unionSchema,
              output: unionSchema,
              handler: async ({input}) => {
                if ('field1' in input) {
                  return {
                    id: `test, ${input.id}`,
                    field1: input.field1
                  };
                }
                return {
                  id: 'other test',
                  field2: input.field2
                };
              }
            })
          }
        },
        version: '3.4.5',
        title: 'Testing issue #98',
        serverUrl: 'http://example.com'
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });
  });
});
