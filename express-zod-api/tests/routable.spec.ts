import { z } from "zod";
import { defaultEndpointsFactory } from "../src";

const endpoint = defaultEndpointsFactory.build({
  output: z.object({}),
  handler: vi.fn(),
});

// @todo consider to mv Routable into AbstractEndpoint
describe.each([endpoint])("Routable mixin %#", (subject) => {
  describe(".nest()", () => {
    test("should return Routing arrangement", () => {
      expect(subject).toHaveProperty("nest", expect.any(Function));
      expect(subject.nest({ subpath: endpoint })).toEqual({
        "": subject,
        subpath: endpoint,
      });
    });
  });
});
