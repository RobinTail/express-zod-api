import {z, withMeta} from '../../src';
import {MetaDef, metaProp} from '../../src/metadata';

describe('Metadata', () => {
  describe('withMeta()', () => {
    test('should return the similar schema', () => {
      const schema = z.string();
      const schemaWithMeta = withMeta(schema);
      expect(schemaWithMeta).toBeInstanceOf(z.ZodString);
      expect(schemaWithMeta).toEqual(schema);
      expect(metaProp).toBe('expressZodApiMeta');
      expect(schemaWithMeta._def).toHaveProperty(metaProp);
      expect(schemaWithMeta._def[metaProp]).toEqual({ examples: [] });
    });

    test('should provide description() method', () => {
      const schema = z.string();
      const schemaWithMeta = withMeta(schema);
      expect(schemaWithMeta).toHaveProperty('description');
      expect(typeof schemaWithMeta.description).toBe('function');
    });

    test('should provide example() method', () => {
      const schema = z.string();
      const schemaWithMeta = withMeta(schema);
      expect(schemaWithMeta).toHaveProperty('example');
      expect(typeof schemaWithMeta.example).toBe('function');
    });

    test('description() should set the corresponding metadata in the schema definition', () => {
      const schema = z.string();
      const schemaWithMeta = withMeta(schema).description('test');
      expect(schemaWithMeta._def[metaProp]).toHaveProperty('description');
      expect(schemaWithMeta._def[metaProp].description).toBe('test');
    });

    test('example() should set the corresponding metadata in the schema definition', () => {
      const schema = z.string();
      const schemaWithMeta = withMeta(schema).example('test');
      expect(schemaWithMeta._def[metaProp]).toHaveProperty('examples');
      expect(schemaWithMeta._def[metaProp].examples).toEqual(['test']);
    });

    test('example() can set multiple examples', () => {
      const schema = z.string();
      const schemaWithMeta = withMeta(schema)
        .example('test1')
        .example('test2')
        .example('test3');
      expect(schemaWithMeta._def[metaProp].examples).toEqual(['test1', 'test2', 'test3']);
    });

    test('should handle multiple metas', () => {
      const schema = z.string();
      const schemaWithMeta = withMeta(schema).description('something').example('test');
      expect(schemaWithMeta._def[metaProp].description).toBe('something');
      expect(schemaWithMeta._def[metaProp].examples).toEqual(['test']);
    });

    test('metadata should withstand refinements', () => {
      const schema = z.string();
      const schemaWithMeta = withMeta(schema).description('test');
      expect(schemaWithMeta._def[metaProp].description).toBe('test');
      expect((
        schemaWithMeta.email()._def as unknown as MetaDef<typeof schemaWithMeta>
      )[metaProp].description).toBe('test');
    });
  });
});
