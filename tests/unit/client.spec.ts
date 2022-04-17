import { routing } from "../../example/routing";
import { Client } from "../../src/client";

describe("API Client Generator", () => {
  test("Should generate a client for example API", () => {
    const client = new Client(routing);
    expect(client.print()).toMatchSnapshot();
  });
});
