import { writeFile, stat } from "node:fs/promises";
import { z } from "zod";

const dest = "src/well-known-headers.json";
const { mtime } = await stat(dest).then(
  (stats) => stats,
  () => ({ mtime: null }),
);

console.info("Current state", mtime);

/**
 * @link https://www.iana.org/assignments/http-fields/http-fields.xhtml
 * @example https://github.com/ladjs/message-headers/blob/master/cron.js
 */
const response = await fetch(
  "https://www.iana.org/assignments/http-fields/field-names.csv",
);
const lastMod = response.headers.get("last-modified");
if (!lastMod)
  throw new Error("Can not get Last-Modified headers from response");
const state = new Date(lastMod);
console.info("Last modified", state);
if (mtime && state <= mtime) process.exit(0);

const csv = await response.text();

const categories = [
  "permanent",
  "deprecated",
  "provisional",
  "obsoleted",
] as const;

const schema = z.object({
  name: z.string().regex(/^[\w-]+$/),
  category: z.enum(categories),
});

const lines = csv.split("\n").slice(1, -1);
const headers = lines
  .map((line) => {
    const [name, category] = line.split(",").slice(0, 2);
    return { name, category };
  })
  .filter((entry) => {
    const { success } = schema.safeParse(entry);
    if (!success) console.debug("excluding", entry);
    return success;
  })
  .map(({ name }) => name.toLowerCase());

console.debug("CRC:", headers.length);

await writeFile(dest, JSON.stringify(headers, undefined, 2), "utf-8");
