import { formatMessage, makeMessagesMap } from "../src/sse";
import { z } from "zod";

const formatMessageRef = formatMessage; // avoid module export getter overhead per iteration

test("Experiment for SSE event formatting", async ({ bench }) => {
  const events = { message: z.string() } as const;
  const schemas = makeMessagesMap(events);
  const current = () =>
    schemas
      .get("message")!
      .transform((props) =>
        [
          `event: ${props.event}`,
          `data: ${JSON.stringify(props.data)}`,
          "",
          "",
        ].join("\n"),
      )
      .parse({ event: "message", data: "hello" });

  const featured = () => formatMessageRef(schemas, "message", "hello");

  await bench.compare(
    bench("current", () => current()),
    bench("featured", () => featured()),
  );
});
