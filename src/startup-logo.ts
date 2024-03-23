import type { ChalkInstance } from "chalk";

export const getStartupLogo = (chalk: ChalkInstance) => {
  const proud = chalk.italic(
    "Proudly supports transgender community.".padStart(109),
  );
  const slogan = chalk.italic(
    "Start your API server with I/O schema validation and custom middlewares in minutes.".padStart(
      109,
    ),
  );
  const thanks = chalk.italic(
    "Thank you for choosing Express Zod API for your project.".padStart(132),
  );
  const dedicationMessage = chalk.italic("for Victoria".padEnd(20));

  const pink = chalk.hex("#F5A9B8");
  const blue = chalk.hex("#5BCEFA");

  const colors = new Array<ChalkInstance>(14)
    .fill(blue, 1, 3)
    .fill(pink, 3, 5)
    .fill(chalk.whiteBright, 5, 7)
    .fill(pink, 7, 9)
    .fill(blue, 9, 12)
    .fill(chalk.gray, 12, 13);

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
`;

  return logo
    .split("\n")
    .map((line, index) => (colors[index] ? colors[index](line) : line))
    .join("\n");
};
