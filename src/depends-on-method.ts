import { head, tail, toPairs } from "ramda";
import { AbstractEndpoint } from "./endpoint";
import { Method } from "./method";

export class DependsOnMethod {
  public readonly pairs: [Method, AbstractEndpoint][];
  public readonly firstEndpoint: AbstractEndpoint | undefined;
  public readonly siblingMethods: Method[];

  constructor(endpoints: Partial<Record<Method, AbstractEndpoint>>) {
    this.pairs = toPairs(endpoints).filter(
      (pair): pair is [Method, AbstractEndpoint] =>
        pair !== undefined && pair[1] !== undefined,
    );
    this.firstEndpoint = head(this.pairs)?.[1];
    this.siblingMethods = tail(this.pairs).map(([method]) => method);
  }
}
