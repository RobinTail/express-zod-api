import { Routing } from "./routing";

export abstract class Nesting {
  /** @desc Enables nested Routing within the path the subject is assigned to */
  public nest(routing: Routing): Routing {
    return Object.assign(routing, { "": this });
  }
}
