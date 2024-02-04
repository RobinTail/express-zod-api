import { z } from "zod";
import { Action, Handler } from "./action";

export interface SimpleActionDef<
  IN extends z.AnyZodTuple,
  E extends EmissionMap,
> {
  input: IN;
  handler: Handler<z.output<IN>, void, E>;
}

export interface AckActionDef<
  IN extends z.AnyZodTuple,
  OUT extends z.AnyZodTuple,
  E extends EmissionMap,
> {
  input: IN;
  output: OUT;
  handler: Handler<z.output<IN>, z.input<OUT>, E>;
}

// @todo make a creator fn
export interface Emission {
  schema: z.AnyZodTuple;
  ack?: z.AnyZodTuple;
}

export interface EmissionMap {
  [event: string]: Emission;
}

export class ActionsFactory<E extends EmissionMap> {
  constructor(protected emission: E) {}

  public build<IN extends z.AnyZodTuple, OUT extends z.AnyZodTuple>(
    def: SimpleActionDef<IN, E> | AckActionDef<IN, OUT, E>,
  ): Action<IN, OUT, E> {
    return new Action(def, this.emission);
  }
}
