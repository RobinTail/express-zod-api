// eslint-disable-next-line import/no-extraneous-dependencies
import chalk from "chalk";
// eslint-disable-next-line import/no-extraneous-dependencies
import { format } from "pretty-format";
import fs from "fs";

const attribution = `
// ANSI font attribution
// Colossal.flf (Jonathon - jon@mq.edu.au), 8 June 1994
`.trim();

const proud = chalk.italic(
  "Proudly supports transgender community.".padStart(109)
);
const slogan = chalk.italic(
  "Start your API server with I/O schema validation and custom middlewares in minutes.".padStart(
    109
  )
);
const thanks = chalk.italic(
  "Thank you for choosing Express Zod API for your project.".padStart(132)
);
const remembrance = chalk.italic("for Alice".padEnd(14));

const logo = [
  chalk.blueBright(`\n
8888888888                                                          8888888888P              888             d8888 8888888b. 8888888 
888                                                                       d88P               888            d88888 888   Y88b  888`),
  chalk.magentaBright(`
888                                                                      d88P                888           d88P888 888    888  888
8888888    888  888 88888b.  888d888 .d88b.  .d8888b  .d8888b           d88P    .d88b.   .d88888          d88P 888 888   d88P  888`),
  chalk.whiteBright(`
888        \`Y8bd8P' 888 "88b 888P"  d8P  Y8b 88K      88K              d88P    d88""88b d88" 888         d88P  888 8888888P"   888   
888          X88K   888  888 888    88888888 "Y8888b. "Y8888b.        d88P     888  888 888  888        d88P   888 888         888`),
  chalk.magentaBright(`
888        .d8""8b. 888 d88P 888    Y8b.          X88      X88       d88P      Y88..88P Y88b 888       d8888888888 888         888   
8888888888 888  888 88888P"  888     "Y8888   88888P'  88888P'      d8888888888 "Y88P"   "Y88888      d88P     888 888       8888888`),
  chalk.blueBright(`
                    888
                    888${proud}
${remembrance}      888${slogan}`),
  chalk.grey(`\n${thanks}`),
  chalk.reset("\n\n"),
].join("");

const serialized = format(logo, { escapeString: false })
  .slice(1, -1)
  .replace("`", "\\`");

const output = `${attribution}\n
export const getStartupLogo = () => {
  return \`
${serialized}
\`.trim();
};
`;

fs.writeFileSync("./src/startup-logo.ts", output);
