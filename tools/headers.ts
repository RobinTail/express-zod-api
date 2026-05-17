import { writeFile } from "node:fs/promises";
import { format } from "prettier";
import OpenAI from "openai";
import { z } from "zod";
import {
  getWellKnownHeaders,
  wellKnownHeadersLastUpdated,
} from "../express-zod-api/src/well-known-headers.ts";
import { responseOnlyHeaders } from "./response-only-headers.ts";

const dest = "express-zod-api/src/well-known-headers.ts";
const exceptionsDest = "tools/response-only-headers.ts";

const writeDest = async (names: string[]) => {
  const tsCode = await format(
    `let cache: Set<string>;\n\n` +
      `export const wellKnownHeadersLastUpdated = ${JSON.stringify(state.toISOString())};\n\n` +
      `export const getWellKnownHeaders = () =>\n` +
      `  (cache ??= new Set(${JSON.stringify(names.sort(), undefined, 2)}));\n`,
    { filepath: dest },
  );
  await writeFile(dest, tsCode, "utf-8");
};

const writeExceptions = async () => {
  const keys = Object.keys(responseOnlyHeaders).sort();
  const entries = keys.map(
    (key) =>
      `"${key}": { proof: ${JSON.stringify(responseOnlyHeaders[key].proof)}, reason: ${JSON.stringify(responseOnlyHeaders[key].reason)} },`,
  );
  const tsCode = await format(
    "export const responseOnlyHeaders: Record<string, { proof: string; reason: string }> = {\n" +
      entries.join("\n") +
      "\n};\n",
    { filepath: exceptionsDest },
  );
  await writeFile(exceptionsDest, tsCode, "utf-8");
};

const exceptionNames = new Set(Object.keys(responseOnlyHeaders));

const response = await fetch(
  "https://www.iana.org/assignments/http-fields/field-names.csv",
);
const lastMod = response.headers.get("last-modified");
if (!lastMod) throw new Error("Can not get Last-Modified header from response");
const state = new Date(lastMod);
console.info("Last modified", state);

const since = new Date(wellKnownHeadersLastUpdated);
if (since >= state) {
  console.info("Up to date since", since);
  process.exit(0);
}

const csv = await response.text();

const categories = ["permanent", "deprecated", "provisional", "obsoleted"];

const lines = csv.split("\n").slice(1, -1);
const allHeaders = lines
  .map((line) => {
    const [name, category] = line.split(",").slice(0, 2);
    return { name, category };
  })
  .filter(
    ({ name, category }) =>
      /^[\w-]+$/.test(name) && categories.includes(category),
  )
  .map(({ name }) => name.toLowerCase());

const existingNames: Set<string> = getWellKnownHeaders();

const newHeaders = allHeaders.filter(
  (name) => !existingNames.has(name) && !exceptionNames.has(name),
);

if (newHeaders.length === 0) {
  console.info("No new headers found, updating timestamp");
  await writeDest([...existingNames]);
  process.exit(0);
}

console.info(
  `Found ${newHeaders.length} new headers: ${newHeaders.join(", ")}`,
);

const token = process.env["GITHUB_TOKEN"];
if (!token) {
  throw new Error(
    "GITHUB_TOKEN environment variable is required for classification",
  );
}

const endpoint = "https://models.github.ai/inference";
const model = "openai/gpt-4.1";
const client = new OpenAI({ baseURL: endpoint, apiKey: token });

const HeaderSchema = z.object({
  name: z.string(),
  location: z.enum(["request", "response", "both"]),
  reason: z.string(),
  proof: z.string(),
});

const ResponseSchema = z.array(HeaderSchema);

const completion = await client.chat.completions.create({
  messages: [
    {
      role: "system",
      content:
        "You are an expert in the HTTP protocol, all of its RFCs and extensions, including but not limited to " +
        "WebSocket (RFC 6455), WebDAV (RFC 4918), EDIINT/AS2 (RFC 6017, RFC 4130), Server-Sent Events, " +
        "CORS (Fetch API), caching (RFC 9111), content negotiation, range requests, authentication, " +
        "WebSub, SCIM, CalDAV, Link Protocol, and all other protocols that extend or use HTTP as a transport.",
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
        `${JSON.stringify(z.toJSONSchema(ResponseSchema))}\n` +
        `\nThe list of headers: ${newHeaders.join(", ")}.`,
    },
  ],
  temperature: 0,
  top_p: 1.0,
  model,
});

const raw = completion.choices[0].message.content;
if (!raw) throw new Error("Empty response from LLM");

console.info("Raw LLM response:", raw);

const parsed = JSON.parse(raw);
const classified: z.infer<typeof ResponseSchema> = ResponseSchema.parse(parsed);

const classifiedNames = new Set(classified.map((h) => h.name));
const missing = newHeaders.filter((n) => !classifiedNames.has(n));
if (missing.length > 0) {
  throw new Error(
    "LLM response missing classifications for: " + missing.join(", "),
  );
}

const responseOnlyNew = classified.filter((h) => h.location === "response");
const others = classified.filter((h) => h.location !== "response");

for (const { name, proof, reason } of responseOnlyNew)
  responseOnlyHeaders[name] = { proof, reason };

await writeExceptions();
console.info(
  `Added ${responseOnlyNew.length} response-only headers to exceptions`,
);

const updatedHeaders = [...existingNames, ...others.map((h) => h.name)];
await writeDest(updatedHeaders);
console.info(
  `Updated well-known-headers.ts with ${updatedHeaders.length} headers`,
);
