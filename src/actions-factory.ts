import { z } from "zod";
import { Action, Handler } from "./action";

export interface SimpleActionDef<IN extends z.ZodTuple> {
  input: IN;
  handler: Handler<z.output<IN>, void>;
}

export interface AckActionDef<IN extends z.ZodTuple, OUT extends z.ZodTuple> {
  input: IN;
  output: OUT;
  handler: Handler<z.output<IN>, z.input<OUT>>;
}

export class ActionsFactory {
  public build<IN extends z.ZodTuple, OUT extends z.ZodTuple>(
    def: SimpleActionDef<IN> | AckActionDef<IN, OUT>,
  ) {
    return new Action(def);
  }
}
