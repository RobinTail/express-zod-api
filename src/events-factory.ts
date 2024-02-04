import { z } from "zod";

export interface EventDefinifion<
  IN extends z.ZodTuple,
  OUT extends z.ZodTuple,
> {
  input: IN;
  output: OUT;
  handler: (...params: z.output<IN>) => Promise<z.input<OUT>>;
}

export class EventsFactory {
  public build<IN extends z.ZodTuple, OUT extends z.ZodTuple>(
    def: EventDefinifion<IN, OUT>,
  ) {
    return def;
  }
}
