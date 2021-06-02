export type Method = 'get' | 'post' | 'put' | 'delete' | 'patch';

export type MethodsDefinition = {
  methods: Method[];
} | {
  method: Method;
};
