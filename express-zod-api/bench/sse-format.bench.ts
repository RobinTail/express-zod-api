import { makeMessageSchema } from "../src/sse";
import { z } from "zod";

const makeMessageSchemaRef = makeMessageSchema;

test("Experiment for SSE event formatting", async ({ bench }) => {
  const events = { message: z.string() } as const;
  const old = () =>
    makeMessageSchemaRef("message", events.message)
      .transform((props) =>
        [
          `event: ${props.event}`,
          `data: ${JSON.stringify(props.data)}`,
          "",
          "", // empty line: events separator
        ].join("\n"),
      )
      .parse({
        event: "message",
        data: "hello",
      });

  const prevJoinNoId = () => {
    const payload = events.message.parse("hello");
    const lines = ["event: message"];
    lines.push(`data: ${JSON.stringify(payload)}`, "", "");
    return lines.join("\n");
  };

  const sanitizeId = (id: string) => id.replace(/[\r\n\0]/g, "");
  const featConcatVerifiedId = (id?: string) => {
    const payload = events.message.parse("hello");
    let message = "event: message\n";
    if (id) message += `id: ${sanitizeId(id)}\n`;
    return message + `data: ${JSON.stringify(payload)}\n\n`;
  };

  await bench.compare(
    bench("old", () => old()),
    bench("prev-join-no-id", () => prevJoinNoId()),
    bench("concat-id-checked", () => featConcatVerifiedId("message##1")),
  );
});
