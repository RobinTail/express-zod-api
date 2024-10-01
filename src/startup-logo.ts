import { Ansis, gray, hex, italic, whiteBright } from "ansis";

const unbin = (subject: unknown) => {
  if (!Array.isArray(subject)) return [];
  const bools = subject.map((encoded) =>
    typeof encoded === "number"
      ? encoded
          .toString(2)
          .split("")
          .map((bit) => bit === "1")
      : [],
  );
  const size = Math.max(...bools.map((row) => row.length));
  return bools.map((row) =>
    Array<boolean>(size - row.length + 1)
      .fill(false) // restores margin of leading zeros
      .concat(row),
  );
};

const render = (data: unknown) => {
  const result = unbin(data);
  const at = (x: number, y: number) =>
    y < result.length && x < result[y].length ? result[y][x] : true;
  const lines: string[] = [];
  for (let row = 0; row < result.length; row += 2) {
    let line = "";
    for (let col = 0; col < result[row].length; col++) {
      if (!at(col, row) && !at(col, row + 1)) line += "\u2588";
      else if (!at(col, row) && at(col, row + 1)) line += "\u2580";
      else if (at(col, row) && !at(col, row + 1)) line += "\u2584";
      else line += " ";
    }
    lines.push(line);
  }
  return lines.join("\n");
};

export const getStartupLogo = () => {
  const proud = italic("Proudly supports transgender community.".padStart(109));
  const slogan = italic(
    "Start your API server with I/O schema validation and custom middlewares in minutes.".padStart(
      109,
    ),
  );
  const thanks = italic(
    "Thank you for choosing Express Zod API for your project.".padStart(132),
  );
  const dedicationMessage = italic("for Zoey".padEnd(20));

  const pink = hex("#F5A9B8");
  const blue = hex("#5BCEFA");

  const colors = new Array<Ansis>(14)
    .fill(blue, 1, 3)
    .fill(pink, 3, 5)
    .fill(whiteBright, 5, 7)
    .fill(pink, 7, 9)
    .fill(blue, 9, 12)
    .fill(gray, 12, 13);

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
${render(process.env.DOCS_QR)}
${render(process.env.GITHUB_QR)}
`;

  return logo
    .split("\n")
    .map((line, index) => (colors[index] ? colors[index](line) : line))
    .join("\n");
};
