import {EndpointsFactory, RouteMethods, z} from '../../src';

describe('Method', () => {
  describe('RouteMethods', () => {
    test('should accept empty object', () => {
      const instance = new RouteMethods({});
      expect(instance).toBeInstanceOf(RouteMethods);
      expect(instance.methods).toEqual({});
    });

    test('should accept an endpoint with a corresponding method', () => {
      const instance = new RouteMethods({
        post: new EndpointsFactory().build({
          method: 'post',
          input: z.object({}),
          output: z.object({}),
          handler: async () => ({})
        })
      });
      expect(instance).toBeInstanceOf(RouteMethods);
      expect(instance.methods).toHaveProperty('post');
    });

    test('should accept an endpoint with additional methods', () => {
      const endpoint = new EndpointsFactory().build({
        methods: ['get', 'post'],
        input: z.object({}),
        output: z.object({}),
        handler: async () => ({})
      });
      const instance = new RouteMethods({
        get: endpoint,
        post: endpoint
      });
      expect(instance).toBeInstanceOf(RouteMethods);
      expect(instance.methods).toHaveProperty('get');
      expect(instance.methods).toHaveProperty('post');
    });

    test('should throw an error if the endpoint does not have the corresponding method', () => {
      const endpoint = new EndpointsFactory().build({
        methods: ['get', 'patch'],
        input: z.object({}),
        output: z.object({}),
        handler: async () => ({})
      });
      expect(() => new RouteMethods({
        get: endpoint,
        post: endpoint
      })).toThrowErrorMatchingSnapshot();
    });
  });
});
