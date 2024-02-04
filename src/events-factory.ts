import { z } from "zod";

export interface EventDefinifion<
  IN extends z.ZodTuple,
  OUT extends z.ZodTuple | undefined,
> {
  input: IN;
  output?: OUT;
  handler: (
    ...params: z.output<IN>
  ) => Promise<OUT extends z.ZodTuple ? z.input<OUT> : void>;
}

export class EventsFactory {
  public build<IN extends z.ZodTuple, OUT extends z.ZodTuple | undefined>(
    def: EventDefinifion<IN, OUT>,
  ) {
    return def;
  }
}
