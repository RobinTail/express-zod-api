import {z, withMeta} from '../../src';
import {MetadataDef} from '../../src/metadata';

describe('Metadata', () => {
  describe('withMeta()', () => {
    test('should return the similar schema', () => {
      const schema = z.string();
      const schemaWithMeta = withMeta(schema);
      expect(schemaWithMeta).toBeInstanceOf(z.ZodString);
      expect(schemaWithMeta).toEqual(schema);
      expect(schemaWithMeta._def).toHaveProperty('meta');
      expect((
        schemaWithMeta._def as unknown as MetadataDef<typeof schemaWithMeta>
      ).meta).toEqual({});
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
      expect((
        schemaWithMeta._def as unknown as MetadataDef<typeof schemaWithMeta>
      ).meta).toHaveProperty('description');
      expect((
        schemaWithMeta._def as unknown as MetadataDef<typeof schemaWithMeta>
      ).meta.description).toBe('test');
    });

    test('example() should set the corresponding metadata in the schema definition', () => {
      const schema = z.string();
      const schemaWithMeta = withMeta(schema).example('test');
      expect((
        schemaWithMeta._def as unknown as MetadataDef<typeof schemaWithMeta>
      ).meta).toHaveProperty('example');
      expect((
        schemaWithMeta._def as unknown as MetadataDef<typeof schemaWithMeta>
      ).meta.example).toBe('test');
    });

    test('metadata should withstand refinements', () => {
      const schema = z.string();
      const schemaWithMeta = withMeta(schema).description('test');
      expect((
        schemaWithMeta._def as unknown as MetadataDef<typeof schemaWithMeta>
      ).meta.description).toBe('test');
      expect((
        schemaWithMeta.email()._def as unknown as MetadataDef<typeof schemaWithMeta>
      ).meta.description).toBe('test');
    });
  });
});
