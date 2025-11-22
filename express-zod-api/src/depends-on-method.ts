import * as R from "ramda";
import { AbstractEndpoint } from "./endpoint";
import { Method } from "./method";
import { Routable } from "./routable";

export class DependsOnMethod extends Routable {
  readonly #endpoints: ConstructorParameters<typeof DependsOnMethod>[0];

  constructor(endpoints: Partial<Record<Method, AbstractEndpoint>>) {
    super();
    this.#endpoints = endpoints;
  }

  /**
   * @desc [method, endpoint]
   * @internal
   * */
  public get entries() {
    const nonempty = R.filter(
      (pair): pair is [Method, AbstractEndpoint] => Boolean(pair[1]),
      Object.entries(this.#endpoints),
    );
    return Object.freeze(nonempty);
  }

  public override deprecated() {
    const deprecatedEndpoints = Object.entries(this.#endpoints).reduce(
      (agg, [method, endpoint]) =>
        Object.assign(agg, { [method]: endpoint.deprecated() }),
      {} as ConstructorParameters<typeof DependsOnMethod>[0],
    );
    return new DependsOnMethod(deprecatedEndpoints) as this;
  }
}
