import { formatMessage, makeMessageSchema } from "../src/sse";
import { z } from "zod";

const formatMessageRef = formatMessage; // avoid module export getter overhead per iteration

test("Experiment for SSE event formatting", async ({ bench }) => {
  const events = { message: z.string() } as const;
  const current = () =>
    makeMessageSchema("message", events.message)
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

  const featured = () => formatMessageRef(events, "message", "hello");

  await bench.compare(
    bench("current", () => current()),
    bench("featured", () => featured()),
  );
});
