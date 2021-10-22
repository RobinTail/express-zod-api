import {z, withMeta} from '../../src';
import {MetadataDef, metadataProp} from '../../src/metadata';

describe('Metadata', () => {
  describe('withMeta()', () => {
    test('should return the similar schema', () => {
      const schema = z.string();
      const schemaWithMeta = withMeta(schema);
      expect(schemaWithMeta).toBeInstanceOf(z.ZodString);
      expect(schemaWithMeta).toEqual(schema);
      expect(metadataProp).toBe('expressZodApiMeta');
      expect(schemaWithMeta._def).toHaveProperty(metadataProp);
      expect(schemaWithMeta._def[metadataProp]).toEqual({ examples: [] });
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
      expect(schemaWithMeta._def[metadataProp]).toHaveProperty('description');
      expect(schemaWithMeta._def[metadataProp].description).toBe('test');
    });

    test('example() should set the corresponding metadata in the schema definition', () => {
      const schema = z.string();
      const schemaWithMeta = withMeta(schema).example('test');
      expect(schemaWithMeta._def[metadataProp]).toHaveProperty('examples');
      expect(schemaWithMeta._def[metadataProp].examples).toEqual(['test']);
    });

    test('example() can set multiple examples', () => {
      const schema = z.string();
      const schemaWithMeta = withMeta(schema)
        .example('test1')
        .example('test2')
        .example('test3');
      expect(schemaWithMeta._def[metadataProp].examples).toEqual(['test1', 'test2', 'test3']);
    });

    test('should handle multiple metas', () => {
      const schema = z.string();
      const schemaWithMeta = withMeta(schema).description('something').example('test');
      expect(schemaWithMeta._def[metadataProp].description).toBe('something');
      expect(schemaWithMeta._def[metadataProp].examples).toEqual(['test']);
    });

    test('metadata should withstand refinements', () => {
      const schema = z.string();
      const schemaWithMeta = withMeta(schema).description('test');
      expect(schemaWithMeta._def[metadataProp].description).toBe('test');
      expect((
        schemaWithMeta.email()._def as unknown as MetadataDef<typeof schemaWithMeta>
      )[metadataProp].description).toBe('test');
    });
  });
});
