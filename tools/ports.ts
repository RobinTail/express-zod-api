import { equals, nAry, when } from "ramda";

const disposer = (function* () {
  let port = 8e3 + 1e2 * Number(process.env.VITEST_POOL_ID);
  while (true) yield port++;
})();

export const givePort = (test?: "example", rsvd = 8090): number =>
  test ? rsvd : when(equals(rsvd), nAry(0, givePort))(disposer.next().value);
