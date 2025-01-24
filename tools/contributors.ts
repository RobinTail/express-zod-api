import { readFile, writeFile } from "node:fs/promises";

const users = new Set();
const changelog = await readFile("CHANGELOG.md", "utf8");
const readme = await readFile("README.md", "utf8");

const links = changelog.matchAll(/\(https:\/\/github\.com\/([-\w]+)\)/g);
for (const link of links) users.add(link[1]);

const markdown = Array.from(users)
  .map(
    (user) =>
      `[<img src="https://github.com/${user}.png" alt="@${user}" width="50px" />](https://github.com/${user})`,
  )
  .join("\n");

const update = readme.replace(
  /## Contributors[^#]+#/,
  `## Contributors\n\n` +
    `These people contributed to the improvement of the framework by reporting bugs, making changes and suggesting ideas:\n\n` +
    `${markdown}\n\n#`,
);

await writeFile("README.md", update, "utf8");
