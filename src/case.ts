import { init, last } from "ramda";
import { z } from "zod";
import { CaseDefinifion } from "./case-factory";
import { InputValidationError, OutputValidationError } from "./errors";
import { AbstractLogger } from "./logger";

export type Handler<
  IN extends z.ZodTuple,
  OUT extends z.ZodTuple | undefined,
> = (
  ...params: z.output<IN>
) => Promise<OUT extends z.ZodTuple ? z.input<OUT> : void>;

export class Case<IN extends z.ZodTuple, OUT extends z.ZodTuple | undefined> {
  readonly #inputSchema: IN;
  readonly #outputSchema: OUT;
  readonly #handler: Handler<IN, OUT>;

  public constructor({ input, output, handler }: CaseDefinifion<IN, OUT>) {
    this.#inputSchema = input;
    this.#outputSchema = output as OUT;
    this.#handler = handler;
  }

  public async execute({
    event,
    params,
    logger,
  }: {
    event: string;
    params: unknown[];
    logger: AbstractLogger;
  }): Promise<void> {
    const payload = this.#outputSchema ? init(params) : params;
    const inputValidation = this.#inputSchema.safeParse(payload);
    if (!inputValidation.success) {
      return logger.error(
        `${event} payload validation error`,
        new InputValidationError(inputValidation.error),
      );
    }
    logger.debug(
      `parsed input (${this.#outputSchema ? "excl." : "no"} ack)`,
      inputValidation.data,
    );
    const ackValidation = this.#outputSchema
      ? z.function(this.#outputSchema, z.void()).safeParse(last(params))
      : undefined;
    if (ackValidation && !ackValidation.success) {
      return logger.error(
        `${event} acknowledgement validation error`,
        new InputValidationError(ackValidation.error),
      );
    }
    const ack = ackValidation?.data;
    const output = await this.#handler(...inputValidation.data);
    if (!this.#outputSchema) {
      return; // no ack
    }
    const outputValidation = this.#outputSchema.safeParse(output);
    if (!outputValidation.success) {
      return logger.error(
        `${event} output validation error`,
        new OutputValidationError(outputValidation.error),
      );
    }
    logger.debug("parsed output", outputValidation.data);
    if (ack) {
      ack(...outputValidation.data);
    }
  }
}
