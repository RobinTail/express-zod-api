import ansi, { StyleFunction } from "ansi-colors";
import { writeFile } from "node:fs/promises";
import {
  exportModifier,
  f,
  makeArrowFn,
  makeConst,
} from "../src/integration-helpers";
import { printNode } from "../src/zts-helpers";
import { format } from "prettier";

const proud = ansi.italic(
  "Proudly supports transgender community.".padStart(109),
);
const slogan = ansi.italic(
  "Start your API server with I/O schema validation and custom middlewares in minutes.".padStart(
    109,
  ),
);
const thanks = ansi.italic(
  "Thank you for choosing Express Zod API for your project.".padStart(132),
);
const dedicationMessage = ansi.italic("for Tonya".padEnd(20));

const pink = ansi.magentaBright; // hex("#F5A9B8")
const blue = ansi.blueBright; // hex("#5BCEFA")

const colors = new Array<StyleFunction>(14)
  .fill(blue, 1, 3)
  .fill(pink, 3, 5)
  .fill(ansi.whiteBright, 5, 7)
  .fill(pink, 7, 9)
  .fill(blue, 9, 12)
  .fill(ansi.grey, 12, 13);

const logo = `
8888888888                                                          8888888888P              888             d8888 8888888b. 8888888
888                                                                       d88P               888            d88888 888   Y88b  888
888                                                                      d88P                888           d88P888 888    888  888
8888888    888  888 88888b.  888d888 .d88b.  .d8888b  .d8888b           d88P    .d88b.   .d88888          d88P 888 888   d88P  888
888        `Y8bd8P' 888 "88b 888P"  d8P  Y8b 88K      88K              d88P    d88""88b d88" 888         d88P  888 8888888P"   888
888          X88K   888  888 888    88888888 "Y8888b. "Y8888b.        d88P     888  888 888  888        d88P   888 888         888
888        .d8""8b. 888 d88P 888    Y8b.          X88      X88       d88P      Y88..88P Y88b 888       d8888888888 888         888
8888888888 888  888 88888P"  888     "Y8888   88888P'  88888P'      d8888888888 "Y88P"   "Y88888      d88P     888 888       8888888
                    888
                    888${proud}
${dedicationMessage}888${slogan}
${thanks}
`
  .split("\n")
  .map((line, index) => (colors[index] ? colors[index](line) : line))
  .join("\n");

const program = f.createVariableStatement(
  exportModifier,
  makeConst(
    f.createIdentifier("getStartupLogo"),
    makeArrowFn([], f.createNoSubstitutionTemplateLiteral(logo)),
  ),
);

const filepath = "./src/startup-logo.ts";
const formatted = await format(printNode(program), { filepath });
await writeFile(filepath, formatted);
