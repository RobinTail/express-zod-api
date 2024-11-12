import { tail, toPairs } from "ramda";
import { AbstractEndpoint } from "./endpoint";
import { Method } from "./method";

export class DependsOnMethod {
  public readonly pairs: ReadonlyArray<[Method, AbstractEndpoint]>;
  public readonly siblingMethods: ReadonlyArray<Method>;

  constructor(endpoints: Partial<Record<Method, AbstractEndpoint>>) {
    this.pairs = Object.freeze(
      toPairs(endpoints).filter(
        (pair): pair is [Method, AbstractEndpoint] =>
          pair !== undefined && pair[1] !== undefined,
      ),
    );
    this.siblingMethods = Object.freeze(
      tail(this.pairs).map(([method]) => method),
    );
  }
}
