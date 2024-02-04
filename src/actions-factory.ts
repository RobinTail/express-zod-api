import { z } from "zod";
import { Action, Handler } from "./action";

export interface ActionDefinifion<
  IN extends z.ZodTuple,
  OUT extends z.ZodTuple | undefined,
> {
  input: IN;
  output?: OUT;
  handler: Handler<z.output<IN>, OUT extends z.ZodTuple ? z.input<OUT> : void>;
}

export class ActionsFactory {
  public build<IN extends z.ZodTuple, OUT extends z.ZodTuple | undefined>(
    def: ActionDefinifion<IN, OUT>,
  ) {
    return new Action(def);
  }
}
