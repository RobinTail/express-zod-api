import { z } from "zod";
import { Action, Handler } from "./action";

export interface SimpleActionDef<IN extends z.ZodTuple, E extends EmissionMap> {
  input: IN;
  handler: Handler<z.output<IN>, void, E>;
}

export interface AckActionDef<
  IN extends z.ZodTuple,
  OUT extends z.ZodTuple,
  E extends EmissionMap,
> {
  input: IN;
  output: OUT;
  handler: Handler<z.output<IN>, z.input<OUT>, E>;
}

// @todo make a creator fn
export interface Emission {
  schema: z.ZodTuple;
  ack?: z.ZodTuple;
}

export interface EmissionMap {
  [event: string]: Emission;
}

// @todo support empty tuples
// @todo support rest in tuples
// @todo see AnyZodTuple
export class ActionsFactory<E extends EmissionMap> {
  constructor(protected emission: E) {}

  public build<IN extends z.ZodTuple, OUT extends z.ZodTuple>(
    def: SimpleActionDef<IN, E> | AckActionDef<IN, OUT, E>,
  ): Action<IN, OUT, E> {
    return new Action(def, this.emission);
  }
}
