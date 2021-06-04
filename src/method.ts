import {Endpoint} from './endpoint';

export type Method = 'get' | 'post' | 'put' | 'delete' | 'patch';

export type MethodsDefinition<M extends Method> = {
  methods: M[];
} | {
  method: M;
};

export class RouteMethods {
  constructor(public readonly methods: Partial<{
    [K in Method]: Endpoint<any, any, any, any, K>
  }>) {
  }
}
