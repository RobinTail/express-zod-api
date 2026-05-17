import { writeFile } from "node:fs/promises";
import { format } from "prettier";
import {
  getWellKnownHeaders,
  wellKnownHeadersLastUpdated,
} from "../express-zod-api/src/well-known-headers.ts";
import { responseOnlyHeaders } from "./response-only-headers.ts";
import { classifyHeaders } from "./rfc-agent.ts";

const dest = "express-zod-api/src/well-known-headers.ts";
const exceptionsDest = "tools/response-only-headers.ts";
const batchSize = 5;

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

for (let i = 0; i < newHeaders.length; i += batchSize) {
  const chunk = newHeaders.slice(i, i + batchSize);
  console.info(`Batch ${Math.floor(i / batchSize) + 1}: ${chunk.join(", ")}`);
  const classified = await classifyHeaders(chunk);
  console.info(classified);
  for (const { name, location, proof, reason } of classified) {
    if (location === "response") responseOnlyHeaders[name] = { proof, reason };
    else existingNames.add(name);
  }
}

await writeExceptions();
await writeDest([...existingNames]);
