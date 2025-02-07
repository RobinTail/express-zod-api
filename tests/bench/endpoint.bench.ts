import { bench } from "vitest";
import { retrieveUserEndpoint } from "../../example/endpoints/retrieve-user";
import { testEndpoint } from "../../express-zod-api/src";

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
