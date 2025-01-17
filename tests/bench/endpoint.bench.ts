import { bench } from "vitest";
import { retrieveUserEndpoint } from "../../example/endpoints/retrieve-user.ts";
import { testEndpoint } from "../../src/index.ts";

describe.skip("Endpoint", () => {
  bench(
    "retrieveUserEndpoint",
    async () => {
      const { responseMock } = await testEndpoint({
        endpoint: retrieveUserEndpoint,
        requestProps: { query: { id: "10" } },
      });
      expect(responseMock._getStatusCode()).toBe(200);
    },
    { time: 15000 },
  );
});
