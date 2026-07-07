import { Ansis, hex, italic, whiteBright } from "ansis";
import { WriteStream } from "node:tty";

export const printStartupLogo = (stream: WriteStream) => {
  if (stream.columns < 62) return;
  const dedication = italic("for Angie".padStart(52));

  const pink = hex("#F5A9B8");
  const blue = hex("#5BCEFA");

  const colors = new Array<Ansis>(19)
    .fill(blue, 1, 5)
    .fill(pink, 5, 8)
    .fill(whiteBright, 8, 12)
    .fill(pink, 12, 15)
    .fill(blue, 15, 18);

  const logo = `
8888888888${dedication}
888
888
8888888    888  888 88888b.  888d888 .d88b.  .d8888b  .d8888b
888        `Y8bd8P' 888 "88b 888P"  d8P  Y8b 88K      88K
888          X88K   888  888 888    88888888 "Y8888b. "Y8888b.
888        .d8""8b. 888 d88P 888    Y8b.          X88      X88
8888888888 888  888 88888P"  888     "Y8888   88888P'  88888P'
                    888
8888888888P         888  888           d8888 8888888b. 8888888                                               
      d88P               888          d88888 888   Y88b  888
     d88P                888         d88P888 888    888  888
    d88P    .d88b.   .d88888        d88P 888 888   d88P  888
   d88P    d88""88b d88" 888       d88P  888 8888888P"   888
  d88P     888  888 888  888      d88P   888 888         888
 d88P      Y88..88P Y88b 888     d8888888888 888         888
d8888888888 "Y88P"   "Y88888    d88P     888 888       8888888

`;

  stream.write(
    logo
      .split("\n")
      .map((line, index) => (colors[index] ? colors[index](line) : line))
      .join("\n"),
  );
};
