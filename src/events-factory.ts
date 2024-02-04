import { z } from "zod";

export interface EventDefinifion<T extends z.ZodTuple> {
  schema: T;
  handler: (...params: z.output<T>) => void | Promise<void>;
}

export class EventsFactory {
  public build<T extends z.ZodTuple>(def: EventDefinifion<T>) {
    return def;
  }
}
