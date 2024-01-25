import { bench, describe, expect } from "vitest";
import { retrieveUserEndpoint } from "../../example/endpoints/retrieve-user";
import { testEndpoint } from "../../src";

describe("Endpoint", () => {
  bench(
    "retrieveUserEndpoint",
    async () => {
      const { responseMock } = await testEndpoint({
        endpoint: retrieveUserEndpoint,
        requestProps: { query: { id: "10" } },
      });
      expect(responseMock.status).toHaveBeenCalledWith(200);
    },
    { time: 1000 },
  );
});
