// @see https://github.com/Microsoft/TypeScript/issues/1213
// @see https://stackoverflow.com/questions/60007436/higher-order-type-functions-in-typescript

export interface Hkt<I = unknown, O = unknown> {
  [Hkt.isHkt]: never;
  [Hkt.input]: I;
  [Hkt.output]: O;
}

export declare namespace Hkt {
  const isHkt: unique symbol;
  const input: unique symbol;
  const output: unique symbol;

  type Input<T extends Hkt<any, any>> = T[typeof Hkt.input];

  type Output<T extends Hkt<any, any>, I extends Input<T>> = (T & {
    [input]: I;
  })[typeof output];

  interface Compose<O, A extends Hkt<any, O>, B extends Hkt<any, Input<A>>>
    extends Hkt<Input<B>, O> {
    [output]: Output<A, Output<B, Input<this>>>;
  }

  interface Constant<T, I = unknown> extends Hkt<I, T> {}
}
