import {Endpoint} from './endpoint';
import {RouteMethodsError} from './errors';

export type Method = 'get' | 'post' | 'put' | 'delete' | 'patch';

export type MethodsDefinition<M extends Method> = {
  methods: M[];
} | {
  method: M;
};

export class RouteMethods {
  constructor(public readonly methods: {
    [K in Method]?: Endpoint<any, any, any, any, K> | Endpoint<any, any, any, any, Method>;
  }) {
    Object.keys(methods).forEach((key: keyof typeof methods) => {
      if (key in methods) {
        const endpointMethods = methods[key]?.getMethods() || [];
        if (!endpointMethods.includes(key)) {
          throw new RouteMethodsError(
            `The endpoint assigned to the '${key}' parameter must have at least this method in its specification.\n` +
            'Example:\n\n' +
            'new RouteMethods({\n' +
            `  ${key}: endpointsFactory.build({\n` +
            `    methods: ['${key}', ` + (
              (methods[key]?.getMethods() || [])
                .map((m) => `'${m}'`)
                .join(', ')
              || '...'
            ) + ']\n' +
            `    // or method: '${key}'\n` +
            '    ...\n' +
            '  })\n' +
            '});\n'
          );
        }
      }
    });
  }
}
