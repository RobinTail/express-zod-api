import { Routing } from "./routing";

export abstract class Routable {
  #isDeprecated = false;
  public abstract clone(): this;

  /** @desc Marks the route as deprecated */
  public deprecated() {
    const copy = this.clone();
    copy.#isDeprecated = true;
    return copy;
  }

  /** @example true - when the route is deprecated */
  public get isDeprecated() {
    return this.#isDeprecated;
  }

  /** @desc Enables nested routes within the path assigned to the subject */
  public nest(routing: Routing): Routing {
    return Object.assign(routing, { "": this });
  }
}
