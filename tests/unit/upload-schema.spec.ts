import {createRootContext} from 'zod';
import {ZodUpload} from '../../src/upload-schema';

describe('ZodUpload', () => {
  describe('static::create()', () => {
    test('should create an instance', () => {
      const schema = ZodUpload.create();
      expect(schema).toBeInstanceOf(ZodUpload);
      expect(schema._def.typeName).toEqual('ZodUpload');
    });
  });

  describe('_parse()', () => {
    test('should handle wrong parsed type', () => {
      const context = createRootContext({});
      const schema = ZodUpload.create();
      const result = schema._parse(context, 123, 'number');
      expect(result).toEqual({
        valid: false
      });
      expect(context.issues).toEqual([{
        code: 'custom',
        message: 'Expected file upload, received number',
        path: [],
      }]);
    });

    test('should accept UploadedFile', () => {
      const context = createRootContext({});
      const schema = ZodUpload.create();
      const buffer = Buffer.from('something');
      const result = schema._parse(context, {
        name: 'avatar.jpg',
        mv: async () => Promise.resolve(),
        encoding: 'utf-8',
        mimetype: 'image/jpeg',
        data: buffer,
        tempFilePath: '',
        truncated: false,
        size: 100500,
        md5: ''
      }, 'object');
      expect(result).toMatchSnapshot();
      expect(context.issues).toEqual([]);
    });
  });
});
