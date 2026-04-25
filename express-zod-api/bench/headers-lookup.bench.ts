import { bench } from "vitest";
import wellKnownHeaders from "../src/well-known-headers";

const target = wellKnownHeaders[wellKnownHeaders.length - 1];

describe("Array.includes vs Set.has for well-known headers lookup", () => {
  const headerSet = new Set(wellKnownHeaders);

  bench("Array.includes", () => {
    wellKnownHeaders.includes(target);
  });

  bench("Set.has", () => {
    headerSet.has(target);
  });
});
