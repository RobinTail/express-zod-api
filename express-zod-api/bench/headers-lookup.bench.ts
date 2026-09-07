import { getWellKnownHeaders } from "../src/well-known-headers";

const target = "x-frame-options";

test("Array.includes vs Set.has for well-known headers lookup", async ({
  bench,
}) => {
  const headersArray = Array.from(getWellKnownHeaders());

  await bench.compare(
    bench("Array.includes", () => {
      headersArray.includes(target);
    }),
    bench("Set.has", () => {
      getWellKnownHeaders().has(target);
    }),
  );
});
