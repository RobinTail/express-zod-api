import {z, withMeta} from '../../src';
import {getMeta} from '../../src/helpers';
import {copyMeta, hasMeta, MetaDef, metaProp} from '../../src/metadata';

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

  describe('hasMeta()', () => {
    test('should return false if the schema definition has no meta prop', () => {
      expect(hasMeta(z.string())).toBeFalsy();
    });
    test('should return false if the meta prop has invalid type', () => {
      const schema1 = z.string();
      const schema2 = z.string();
      Object.defineProperty(schema1._def, metaProp, {value: null});
      expect(hasMeta(schema1)).toBeFalsy();
      Object.defineProperty(schema2._def, metaProp, {value: 123});
      expect(hasMeta(schema2)).toBeFalsy();
    });
    test('should return true if withMeta() has been used', () => {
      expect(hasMeta(withMeta(z.string()))).toBeTruthy();
    });
  });

  describe('copyMeta()', () => {
    test('should return the same dest schema in case src one has no meta', () => {
      const src = z.string();
      const dest = z.number();
      const result = copyMeta(src, dest);
      expect(result).toEqual(dest);
      expect(hasMeta(result)).toBeFalsy();
      expect(hasMeta(dest)).toBeFalsy();
    });
    test('should copy meta from src to dest in case meta is defined', () => {
      const src = withMeta(z.string()).description('test').example('some');
      const dest = z.number();
      const result = copyMeta(src, dest);
      expect(hasMeta(result)).toBeTruthy();
      expect(getMeta(result, 'description')).toBe(getMeta(src, 'description'));
      expect(getMeta(result, 'examples')).toEqual(getMeta(src, 'examples'));
      expect(result).toEqual(dest);
    });

    // @todo I believe it should actually merge them somehow
    test('should replace meta in dest by the one from src', () => {
      const src = withMeta(z.object({
        a: z.string()
      })).description('test').example({
        a: 'some'
      });
      const dest = withMeta(z.object({
        b: z.number()
      })).description('other').example({
        b: 123
      });
      const result = copyMeta(src, dest);
      expect(hasMeta(result)).toBeTruthy();
      expect(getMeta(result, 'description')).toBe(getMeta(src, 'description'));
      expect(getMeta(result, 'examples')).toEqual(getMeta(src, 'examples'));
      expect(result).toEqual(dest);
    });
  });
});
