import ollama, { type Message, type Tool, type ChatRequest } from "ollama";
import { z } from "zod";

const txtContextRadius = 3;
const txtMaxLen = 3000;

const makeResponseSchema = (names: string[]) =>
  z
    .array(
      z.object({
        name: z.literal(names).describe("the header name"),
        location: z
          .enum(["request", "response", "both"])
          .describe("classification"),
        reason: z.string().describe("why this header is classified this way"),
        proof: z
          .string()
          .describe("reference to a relevant RFC or documentation"),
      }),
    )
    .length(names.length);

const lookupInfo = z.function({
  input: [
    z.object({
      subject: z
        .int()
        .positive()
        .or(z.string())
        .describe("The RFC number or document id to look up"),
    }),
  ],
  output: z.string(),
});

const tools: Tool[] = [
  {
    type: "function",
    function: {
      name: "lookup_info",
      description:
        "Search the given RFC or a document for mentions of the headers in question. " +
        "Returns excerpts around matching lines.",
      parameters:
        lookupInfo.def.input.def.items[0].toJSONSchema() as Tool["function"]["parameters"],
    },
  },
];

export const classifyHeaders = async (
  headers: { name: string; info: string }[],
): Promise<z.infer<ReturnType<typeof makeResponseSchema>>> => {
  const ResponseSchema = makeResponseSchema(headers.map(({ name }) => name));
  const headerPattern = headers
    .map(({ name }) => name)
    .filter((h) => /^[\w-]+$/.test(h))
    .join("|");
  const txtLookupRegex = new RegExp(`\\b(${headerPattern})\\b`, "gi");

  const lookup = lookupInfo.implementAsync(async ({ subject }) => {
    console.info(`Looking up ${subject}...`);
    const url =
      typeof subject === "number"
        ? `https://www.rfc-editor.org/rfc/rfc${subject}.txt`
        : `https://www.ietf.org/archive/id/draft-${subject}.txt`;
    let text: string;
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!resp.ok) return "Error: not found";
      text = await resp.text();
    } catch {
      return "Error: Failed to fetch";
    }
    const txtLines = text.split("\n");
    const excerpts: string[] = [];
    let totalLength = 0;
    for (let i = 0; i < txtLines.length; i++) {
      txtLookupRegex.lastIndex = 0;
      if (!txtLookupRegex.test(txtLines[i]!)) continue;
      const start = Math.max(0, i - txtContextRadius);
      const end = Math.min(txtLines.length, i + txtContextRadius + 1);
      const excerpt = txtLines.slice(start, end).join("\n");
      const block = `--- Context around line ${i + 1} ---\n${excerpt}`;
      excerpts.push(block);
      totalLength += block.length;
      if (totalLength > txtMaxLen) break;
    }
    if (excerpts.length > 0) return excerpts.join("\n\n");
    return text.slice(0, txtMaxLen) + "…";
  });

  const messages: Message[] = [
    {
      role: "system",
      content:
        "You are an expert in the HTTP protocol, all of its RFCs and extensions, including but not limited to " +
        "WebSocket (RFC 6455), WebDAV (RFC 4918), EDIINT/AS2 (RFC 6017, RFC 4130), Server-Sent Events, CORS (Fetch " +
        "API), caching (RFC 9111), Compression Dictionary Transport (RFC 9842), content negotiation, range requests, " +
        "authentication, WebSub, SCIM, CalDAV, Link Protocol, and all other protocols that extend or use HTTP as a " +
        "transport. CRITICAL: use the lookup_info tool to read to latest information about the headers.",
    },
    {
      role: "user",
      content:
        `For each HTTP header in the following list, determine if it can be present either only ` +
        `in a request, only in a response, or both, considering ALL uses across all HTTP extensions ` +
        `(WebSocket, WebDAV, EDIINT, file transfer, W3C specifications, etc.). When classifying a header, consider ` +
        `its definition across ALL relevant RFCs and specifications, not just one. A header that appears ` +
        `in both requests and responses in any specification should be classified as 'both', even if ` +
        `it is most commonly seen in one direction. The list of headers and where to find info:\n` +
        headers.map(({ name, info }) => `- ${name}: ${info}`).join(",\n") +
        ".",
    },
  ];

  console.log(messages);

  const agentConfig: ChatRequest & { stream: false } = {
    tools,
    messages,
    model: "qwen3:8b",
    stream: false,
    options: {
      temperature: 0,
      top_p: 1,
    },
  };

  let completion = await ollama.chat(agentConfig);
  console.log(completion);
  let toolCallCount = 0;

  while (completion.message.tool_calls?.length) {
    messages.push(completion.message);
    for (const toolCall of completion.message.tool_calls ?? []) {
      if (!("function" in toolCall)) continue;
      console.log("calling with", toolCall.function.arguments);
      const content = await lookup(
        toolCall.function.arguments as { subject: string },
      );
      if (content.startsWith("Error:")) console.error(content);
      else console.info(`Retrieved (${content.length} chars)`);
      messages.push({
        role: "tool",
        tool_name: toolCall.function.name,
        content,
      });
      toolCallCount++;
    }
    if (toolCallCount >= headers.length) agentConfig.tools = [];
    completion = await ollama.chat(agentConfig);
  }

  console.log("pure text conclusion:", completion.message.content);
  agentConfig.tools = [];
  agentConfig.messages = [
    {
      role: "user",
      content:
        `classify each of the following headers accordingly as either 'request' or 'response' or 'both', ` +
        `knowing the following information:\n${completion.message.content}`,
    },
  ];
  agentConfig.format = z.toJSONSchema(ResponseSchema);
  completion = await ollama.chat(agentConfig);

  const raw = completion.message.content;
  if (!raw) throw new Error("Empty response from LLM");

  const parsed = JSON.parse(raw);
  return ResponseSchema.parse(parsed);
};
