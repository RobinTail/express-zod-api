import { bench } from "vitest";
import { getWellKnownHeaders } from "../src/well-known-headers";

const target = "x-frame-options";

describe("Array.includes vs Set.has for well-known headers lookup", () => {
  const headersArray = Array.from(getWellKnownHeaders());

  bench("Array.includes", () => {
    headersArray.includes(target);
  });

  bench("Set.has", () => {
    getWellKnownHeaders().has(target);
  });
});
