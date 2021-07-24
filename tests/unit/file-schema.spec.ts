import {ZodFile} from '../../src/file-schema';

describe('ZodFile', () => {
  describe('static::create()', () => {
    test('should create an instance', () => {
      const schema = ZodFile.create();
      expect(schema).toBeInstanceOf(ZodFile);
      expect(schema._def.checks).toEqual([]);
      expect(schema._def.typeName).toEqual('ZodFile');
      expect(schema.isBinary).toBeFalsy();
      expect(schema.isBase64).toBeFalsy();
    });
  });

  describe('.binary()', () => {
    test('should create a binary file', () => {
      const schema = ZodFile.create().binary('test message');
      expect(schema).toBeInstanceOf(ZodFile);
      expect(schema.isBinary).toBeTruthy();
      expect(schema._def.checks).toEqual([{
        kind: 'binary',
        message: 'test message'
      }]);
    });
  });

  describe('.base64()', () => {
    test('should create a base64 file', () => {
      const schema = ZodFile.create().base64('test message');
      expect(schema).toBeInstanceOf(ZodFile);
      expect(schema.isBase64).toBeTruthy();
      expect(schema._def.checks).toEqual([{
        kind: 'base64',
        message: 'test message'
      }]);
    });
  });
});
