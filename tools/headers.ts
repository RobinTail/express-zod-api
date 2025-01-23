import { writeFile } from "node:fs/promises";
import { z } from "zod";

/**
 * @link https://www.iana.org/assignments/http-fields/http-fields.xhtml
 * @example https://github.com/ladjs/message-headers/blob/master/cron.js
 */
const csv = await (
  await fetch("https://www.iana.org/assignments/http-fields/field-names.csv")
).text();

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

await writeFile(
  "src/well-known-headers.json",
  JSON.stringify(headers),
  "utf-8",
);
