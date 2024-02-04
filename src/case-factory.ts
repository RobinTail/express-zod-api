import { z } from "zod";
import { Case, Handler } from "./case";

export interface CaseDefinifion<
  IN extends z.ZodTuple,
  OUT extends z.ZodTuple | undefined,
> {
  input: IN;
  output?: OUT;
  handler: Handler<z.output<IN>, OUT extends z.ZodTuple ? z.input<OUT> : void>;
}

export class CaseFactory {
  public build<IN extends z.ZodTuple, OUT extends z.ZodTuple | undefined>(
    def: CaseDefinifion<IN, OUT>,
  ) {
    return new Case(def);
  }
}
