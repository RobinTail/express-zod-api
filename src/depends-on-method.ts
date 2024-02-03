import { head, isNil, tail, toPairs } from "ramda";
import { AbstractEndpoint } from "./endpoint";
import { Method } from "./method";

export class DependsOnMethod {
  public readonly pairs: [Method, AbstractEndpoint][];
  public readonly firstEndpoint: AbstractEndpoint | undefined;
  public readonly siblingMethods: Method[];

  constructor(
    /**
     * @deprecated use pairs instead
     * @todo remove from public in v17
     * */
    public readonly endpoints: Partial<Record<Method, AbstractEndpoint>>,
  ) {
    this.pairs = toPairs(endpoints).filter(
      (entry): entry is [Method, AbstractEndpoint] =>
        !isNil(entry) && !isNil(entry[1]),
    );
    this.firstEndpoint = head(this.pairs)?.[1];
    this.siblingMethods = tail(this.pairs).map(([method]) => method);
  }
}
