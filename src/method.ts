import {Endpoint} from './endpoint';
import {DependsOnMethodError} from './errors';

export type Method = 'get' | 'post' | 'put' | 'delete' | 'patch';

export type MethodsDefinition<M extends Method> = {
  methods: M[];
} | {
  method: M;
};

export class DependsOnMethod {
  constructor(public readonly methods: {
    [K in Method]?: Endpoint<any, any, any, any, K> | Endpoint<any, any, any, any, Method>;
  }) {
    Object.keys(methods).forEach((key: keyof typeof methods) => {
      if (key in methods) {
        const endpointMethods = methods[key]?.getMethods() || [];
        if (!endpointMethods.includes(key)) {
          throw new DependsOnMethodError(
            `The endpoint assigned to the '${key}' parameter must have at least this method in its specification.\n` +
            'This error should prevent mistakes during the development process.\n' +
            'Example:\n\n' +
            `new ${this.constructor.name}({\n` +
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
