import { keys, reject, equals } from "ramda";
import { AbstractEndpoint } from "./endpoint";
import { Method } from "./method";
import { Routable } from "./routable";

export class DependsOnMethod extends Routable {
  constructor(protected endpoints: Partial<Record<Method, AbstractEndpoint>>) {
    super();
  }

  /** @desc [method, endpoint, siblingMethods] */
  public get entries(): ReadonlyArray<[Method, AbstractEndpoint, Method[]]> {
    const entries: Array<(typeof this.entries)[number]> = [];
    const methods = keys(this.endpoints); // eslint-disable-line no-restricted-syntax -- literal type required
    for (const method of methods) {
      const endpoint = this.endpoints[method];
      if (endpoint)
        entries.push([method, endpoint, reject(equals(method), methods)]);
    }
    return Object.freeze(entries);
  }

  public override clone() {
    return new DependsOnMethod(this.endpoints) as this;
  }
}
