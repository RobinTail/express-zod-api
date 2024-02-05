import { z } from "zod";
import { Action, Handler } from "./action";
import { EmissionMap } from "./emission";
import { SocketsConfig } from "./sockets";

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

export class ActionsFactory<E extends EmissionMap> {
  constructor(protected config: SocketsConfig<E>) {}

  public build<IN extends z.AnyZodTuple, OUT extends z.AnyZodTuple>(
    def: SimpleActionDef<IN, E> | AckActionDef<IN, OUT, E>,
  ): Action<IN, OUT> {
    return new Action(def);
  }
}
