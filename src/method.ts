export type Method = 'get' | 'post' | 'put' | 'delete' | 'patch';

export type MethodsDefinition<M extends Method> = {
  methods: M[];
} | {
  method: M;
};
