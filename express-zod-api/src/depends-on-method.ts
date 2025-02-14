import { keys, reject, equals } from "ramda";
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
   * @desc [method, endpoint, siblingMethods]
   * @internal
   * */
  public get entries(): ReadonlyArray<[Method, AbstractEndpoint, Method[]]> {
    const entries: Array<(typeof this.entries)[number]> = [];
    const methods = keys(this.#endpoints); // eslint-disable-line no-restricted-syntax -- literal type required
    for (const method of methods) {
      const endpoint = this.#endpoints[method];
      if (endpoint)
        entries.push([method, endpoint, reject(equals(method), methods)]);
    }
    return Object.freeze(entries);
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
