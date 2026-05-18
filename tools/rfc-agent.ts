import OpenAI from "openai";
import { z } from "zod";
import type {
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionTool,
} from "openai/resources";

const rfcContextRadius = 3;
const rfcMaxLen = 3000;

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

const lookupRfcSchema = z.function({
  input: [
    z.object({
      number: z.int().positive().describe("The RFC number to look up"),
    }),
  ],
  output: z.string(),
});

const tools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "lookup_rfc",
      description:
        "Search the given RFC number for mentions of the headers in question. " +
        "Returns excerpts around matching lines.",
      parameters: lookupRfcSchema.def.input.def.items[0].toJSONSchema(),
    },
  },
];

export const classifyHeaders = async (
  headers: string[],
): Promise<z.infer<ReturnType<typeof makeResponseSchema>>> => {
  const apiKey = process.env["GITHUB_TOKEN"];
  if (!apiKey) throw new Error("GITHUB_TOKEN environment variable is required");
  const client = new OpenAI({
    apiKey,
    baseURL: "https://models.github.ai/inference",
    timeout: 30000,
    maxRetries: 0,
  });
  const ResponseSchema = makeResponseSchema(headers);
  const headerPattern = headers.filter((h) => /^[\w-]+$/.test(h)).join("|");
  const rfcLookupRegex = new RegExp(`\\b(${headerPattern})\\b`, "gi");

  const lookupRfc = lookupRfcSchema.implementAsync(async ({ number }) => {
    console.info(`Looking up RFC ${number}...`);
    const url = `https://www.rfc-editor.org/rfc/rfc${number}.txt`;
    let text: string;
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!resp.ok) return `Error: RFC ${number} not found`;
      text = await resp.text();
    } catch {
      return `Error: Failed to fetch RFC ${number}`;
    }
    const rfcLines = text.split("\n");
    const excerpts: string[] = [];
    let totalLength = 0;
    for (let i = 0; i < rfcLines.length; i++) {
      rfcLookupRegex.lastIndex = 0;
      if (!rfcLookupRegex.test(rfcLines[i])) continue;
      const start = Math.max(0, i - rfcContextRadius);
      const end = Math.min(rfcLines.length, i + rfcContextRadius + 1);
      const excerpt = rfcLines.slice(start, end).join("\n");
      const block = `--- Context around line ${i + 1} ---\n${excerpt}`;
      excerpts.push(block);
      totalLength += block.length;
      if (totalLength > rfcMaxLen) break;
    }
    if (excerpts.length > 0) return excerpts.join("\n\n");
    return text.slice(0, rfcMaxLen) + "…";
  });

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content:
        "You are an expert in the HTTP protocol, all of its RFCs and extensions, including but not limited to " +
        "WebSocket (RFC 6455), WebDAV (RFC 4918), EDIINT/AS2 (RFC 6017, RFC 4130), Server-Sent Events, CORS (Fetch " +
        "API), caching (RFC 9111), Compression Dictionary Transport (RFC 9842), content negotiation, range requests, " +
        "authentication, WebSub, SCIM, CalDAV, Link Protocol, and all other protocols that extend or use HTTP as a " +
        "transport. When your knowledge is uncertain — use the lookup_rfc tool that can fetch the latest RFC content.",
    },
    {
      role: "user",
      content:
        `For each HTTP header in the following list, determine if it can be present either only ` +
        `in a request, only in a response, or both, considering ALL uses across all HTTP extensions ` +
        `(WebSocket, WebDAV, EDIINT, file transfer, W3C specifications, etc.). When classifying a header, consider ` +
        `its definition across ALL relevant RFCs and specifications, not just one. A header that appears ` +
        `in both requests and responses in any specification should be classified as 'both', even if ` +
        `it is most commonly seen in one direction. Provide a reason and a proof. Respond according to the schema:\n` +
        `${JSON.stringify(z.toJSONSchema(ResponseSchema))}\n\n` +
        `The list of headers: ${headers.join(", ")}.`,
    },
  ];

  const agentConfig: ChatCompletionCreateParamsNonStreaming = {
    tools,
    messages,
    model: "openai/gpt-4.1",
    tool_choice: "auto",
    temperature: 0,
    top_p: 1.0,
  };

  let completion = await client.chat.completions.create(agentConfig);
  let toolCallCount = 0;

  while (completion.choices[0].finish_reason === "tool_calls") {
    const choice = completion.choices[0];
    messages.push(choice.message);
    for (const toolCall of choice.message.tool_calls ?? []) {
      if (!("function" in toolCall)) continue;
      const content = await lookupRfc(JSON.parse(toolCall.function.arguments));
      if (content.startsWith("Error:")) console.error(content);
      else console.info(`Retrieved (${content.length} chars)`);
      messages.push({ role: "tool", tool_call_id: toolCall.id, content });
      toolCallCount++;
    }
    if (toolCallCount >= headers.length) agentConfig.tool_choice = "none";
    completion = await client.chat.completions.create(agentConfig);
  }

  const raw = completion.choices[0].message.content;
  if (!raw) throw new Error("Empty response from LLM");

  const parsed = JSON.parse(raw);
  return ResponseSchema.parse(parsed);
};
