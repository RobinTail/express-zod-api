import { Endpoint } from "./endpoint";
import { Method } from "./method";

type EndpointHaving<S, K extends Method> = S extends Endpoint<
  any,
  any,
  any,
  infer M,
  any,
  any,
  any,
  any
>
  ? K extends M
    ? S
    : never
  : never;

export class DependsOnMethod<
  T extends {
    [K in Method]?: EndpointHaving<T[K], K>;
  },
> {
  constructor(public readonly endpoints: T) {}
}
