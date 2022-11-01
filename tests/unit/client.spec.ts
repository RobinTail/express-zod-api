import { routing } from "../../example/routing";
import { Client, defaultEndpointsFactory, z } from "../../src";
import { Endpoint } from "../../src/endpoint";
import { IOSchemaError } from "../../src/errors";
import { mimeJson } from "../../src/mime";

describe("API Client Generator", () => {
  test("Should generate a client for example API", () => {
    const client = new Client(routing);
    expect(client.print()).toMatchSnapshot();
  });

  test("Should treat optionals the same way as z.infer()", () => {
    const client = new Client({
      v1: {
        test: defaultEndpointsFactory.build({
          method: "post",
          input: z.object({
            opt: z.string().optional(),
          }),
          output: z.object({
            similar: z.number().optional(),
          }),
          handler: async () => ({}),
        }),
      },
    });
    expect(client.print()).toMatchSnapshot();
  });

  describe("Feature #600: Top level refinements", () => {
    test("should throw when using transformation", () => {
      expect(
        () =>
          new Client({
            v1: {
              test: new Endpoint({
                method: "get",
                inputSchema: z.object({}).transform(() => []),
                mimeTypes: [mimeJson],
                outputSchema: z.object({}),
                handler: jest.fn(),
                resultHandler: {
                  getPositiveResponse: jest.fn(),
                  getNegativeResponse: jest.fn(),
                  handler: jest.fn(),
                },
                middlewares: [],
              }),
            },
          })
      ).toThrowError(
        new IOSchemaError(
          "Using transformations on the top level of input schema is not allowed."
        )
      );
    });
  });
});
