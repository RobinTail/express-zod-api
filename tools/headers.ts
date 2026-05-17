import { readFile, writeFile } from "node:fs/promises";
import { format } from "prettier";
import { parse, stringify } from "yaml";
import OpenAI from "openai";
import { z } from "zod";
import {
  getWellKnownHeaders,
  wellKnownHeadersLastUpdated,
} from "../express-zod-api/src/well-known-headers.ts";

const dest = "express-zod-api/src/well-known-headers.ts";
const exceptionsPath = "tools/response-only-headers.yml";

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

let responseOnlyHeaders: Record<string, { proof: string; reason: string }> = {};
try {
  const yamlContent = await readFile(exceptionsPath, "utf-8");
  responseOnlyHeaders = parse(yamlContent) as typeof responseOnlyHeaders;
} catch {
  console.warn("No exceptions file found, starting fresh");
}
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
        "You are an expert in HTTP protocol, all of its RFCs and documentation.",
    },
    {
      role: "user",
      content:
        `For each HTTP header in the following list, determine if it can be present either only ` +
        `in a request, only in a response, or both. Provide a reason and proof (reference to RFC ` +
        `or documentation). Respond according to the schema:\n` +
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

let classified: z.infer<typeof ResponseSchema>;
try {
  const parsed = JSON.parse(raw);
  classified = ResponseSchema.parse(parsed);
} catch (err) {
  console.error("Failed to parse or validate LLM response:", err);
  process.exit(1);
}

const classifiedNames = new Set(classified.map((h) => h.name));
const missing = newHeaders.filter((n) => !classifiedNames.has(n));
if (missing.length > 0) {
  console.error(
    "LLM response missing classifications for:",
    missing.join(", "),
  );
  process.exit(1);
}

const responseOnlyNew = classified.filter((h) => h.location === "response");
const others = classified.filter((h) => h.location !== "response");

for (const h of responseOnlyNew)
  responseOnlyHeaders[h.name] = { proof: h.proof, reason: h.reason };

const sortedExceptionKeys = Object.keys(responseOnlyHeaders).sort();
const sortedExceptions: Record<string, { proof: string; reason: string }> = {};
for (const key of sortedExceptionKeys)
  sortedExceptions[key] = responseOnlyHeaders[key];

await writeFile(
  exceptionsPath,
  stringify(sortedExceptions, { indent: 2, lineWidth: 0 }),
  "utf-8",
);
console.info(
  `Added ${responseOnlyNew.length} response-only headers to exceptions`,
);

const updatedHeaders = [...existingNames, ...others.map((h) => h.name)];
await writeDest(updatedHeaders);
console.info(
  `Updated well-known-headers.ts with ${updatedHeaders.length} headers`,
);
