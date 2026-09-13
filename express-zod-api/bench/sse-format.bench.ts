import { makeMessageSchema } from "../src/sse";
import { z } from "zod";

const makeMessageSchemaRef = makeMessageSchema;

test("Experiment for SSE event formatting", async ({ bench }) => {
  const events = { message: z.string() } as const;
  const prev = () =>
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

  const useJoin = (id?: string) => {
    const payload = events.message.parse("hello");
    const lines = ["event: message"];
    if (id) lines.push(`id: ${id}`);
    lines.push(`data: ${JSON.stringify(payload)}`, "", "");
    return lines.join("\n");
  };

  const useConcat = (id?: string) => {
    const payload = events.message.parse("hello");
    let message = "event: message\n";
    if (id) message += `id: ${id}\n`;
    return message + `data: ${JSON.stringify(payload)}\n\n`;
  };

  await bench.compare(
    bench("previous", () => prev()),
    bench("join with id", () => useJoin("message##1")),
    bench("concat with id", () => useConcat("message##1")),
  );
});
