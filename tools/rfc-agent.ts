import OpenAI from "openai";
import { z } from "zod";
import type {
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionTool,
} from "openai/resources";

const rfcContextRadius = 3;

const HeaderSchema = z.object({
  name: z.string(),
  location: z.enum(["request", "response", "both"]),
  reason: z.string(),
  proof: z.string(),
});

const ResponseSchema = z.array(HeaderSchema);

const token = process.env["GITHUB_TOKEN"];
if (!token) {
  throw new Error(
    "GITHUB_TOKEN environment variable is required for classification",
  );
}

const tools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "lookup_rfc",
      description:
        "Fetch the content of an RFC by its number to verify how a specific HTTP header is defined and whether it can appear in requests, responses, or both",
      parameters: {
        type: "object",
        properties: {
          number: { type: "number", description: "The RFC number to look up" },
        },
        required: ["number"],
        additionalProperties: false,
      },
    },
  },
];

export const classifyHeaders = async (
  headers: string[],
): Promise<z.infer<typeof ResponseSchema>> => {
  const endpoint = "https://models.github.ai/inference";
  const model = "openai/gpt-4.1";
  const client = new OpenAI({ baseURL: endpoint, apiKey: token });
  const headerPattern = headers.join("|");
  const rfcLookupRegex = new RegExp(`\\b(${headerPattern})\\b`, "gi");

  const lookupRfc = async (number: number): Promise<string> => {
    const url = `https://www.rfc-editor.org/rfc/rfc${number}.txt`;
    const resp = await fetch(url);
    if (!resp.ok) return `Error: RFC ${number} not found`;
    const text = await resp.text();
    const rfcLines = text.split("\n");
    const excerpts: string[] = [];
    let totalLength = 0;
    for (let i = 0; i < rfcLines.length; i++) {
      rfcLookupRegex.lastIndex = 0;
      if (rfcLookupRegex.test(rfcLines[i])) {
        const start = Math.max(0, i - rfcContextRadius);
        const end = Math.min(rfcLines.length, i + rfcContextRadius + 1);
        const excerpt = rfcLines.slice(start, end).join("\n");
        const block = `--- Context around line ${i + 1} ---\n${excerpt}`;
        excerpts.push(block);
        totalLength += block.length;
        if (totalLength > 5000) break;
      }
    }
    if (excerpts.length > 0) return excerpts.join("\n\n");
    return text.slice(0, 3000) + "\n\n...(truncated)";
  };

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content:
        "You are an expert in the HTTP protocol, all of its RFCs and extensions, including but not limited to " +
        "WebSocket (RFC 6455), WebDAV (RFC 4918), EDIINT/AS2 (RFC 6017, RFC 4130), Server-Sent Events, " +
        "CORS (Fetch API), caching (RFC 9111), content negotiation, range requests, authentication, " +
        "WebSub, SCIM, CalDAV, Link Protocol, and all other protocols that extend or use HTTP as a transport. " +
        "You have access to a lookup_rfc tool that can fetch the latest RFC content for verification.",
    },
    {
      role: "user",
      content:
        `For each HTTP header in the following list, determine if it can be present either only ` +
        `in a request, only in a response, or both, considering ALL uses across all HTTP extensions ` +
        `(WebSocket, WebDAV, EDIINT, file transfer, etc.). When classifying a header, consider its ` +
        `definition across ALL relevant RFCs and specifications, not just one. A header that appears ` +
        `in both requests and responses in any specification should be classified as 'both', even if ` +
        `it is most commonly seen in one direction. Provide a reason and proof (reference to ` +
        `the relevant RFC or documentation). Respond according to the schema:\n` +
        `${JSON.stringify(z.toJSONSchema(ResponseSchema))}\n\n` +
        `The list of headers: ${headers.join(", ")}. ` +
        `Use the lookup_rfc tool when you need to verify the definition of a header across RFCs.`,
    },
  ];

  const agentConfig: ChatCompletionCreateParamsNonStreaming = {
    model,
    tools,
    messages,
    tool_choice: "auto",
    temperature: 0,
    top_p: 1.0,
  };

  let completion = await client.chat.completions.create(agentConfig);

  while (completion.choices[0].finish_reason === "tool_calls") {
    const choice = completion.choices[0];
    messages.push(choice.message);
    for (const toolCall of choice.message.tool_calls ?? []) {
      if (!("function" in toolCall)) continue;
      const { number } = JSON.parse(toolCall.function.arguments);
      console.info(`Looking up RFC ${number}...`);
      const content = await lookupRfc(Number(number) || 0);
      if (content.startsWith("Error:")) console.error(content);
      else console.info(`RFC ${number} retrieved (${content.length} chars)`);
      messages.push({ role: "tool", tool_call_id: toolCall.id, content });
    }
    completion = await client.chat.completions.create(agentConfig);
  }

  const raw = completion.choices[0].message.content;
  if (!raw) throw new Error("Empty response from LLM");

  const parsed = JSON.parse(raw);
  return ResponseSchema.parse(parsed);
};
