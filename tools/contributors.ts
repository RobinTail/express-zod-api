import { readFile } from "node:fs/promises";

const users = new Set();
const changelog = await readFile("CHANGELOG.md", "utf8");

const links = changelog.matchAll(/\(https:\/\/github\.com\/([-\w]+)\)/g);
for (const link of links) {
  users.add(link[1]);
}

const markdown = Array.from(users)
  .map(
    (user) =>
      `[<img src="https://github.com/${user}.png" alt="@${user}" width="50px" />](https://github.com/${user})`,
  )
  .join("\n");

console.log(markdown);
